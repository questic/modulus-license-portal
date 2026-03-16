import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { cors, handleOptions } from '../_shared/cors.ts';
import { generateLicenseKey, LicenseData } from '../_shared/crypto.ts';
import { sendLicenseEmail } from '../_shared/email.ts';
import { sendTelegramMessage } from '../_shared/telegram.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOptions();

  const password = req.headers.get('x-admin-password');
  if (!password || password !== Deno.env.get('ADMIN_PASSWORD')) {
    return cors({ error: 'Unauthorized' }, 401);
  }

  try {
    const { id, expiresAt, features } = await req.json();
    if (!id) return cors({ error: 'id обязателен' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: request, error: fetchErr } = await supabase
      .from('license_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !request) return cors({ error: 'Заявка не найдена' }, 404);

    const licenseData: LicenseData = {
      machineId: request.machine_id,
      licensee: request.name,
      issuedAt: new Date().toISOString().split('T')[0],
      expiresAt: expiresAt ?? null,
      features: features ?? [],
    };

    const licenseKey = await generateLicenseKey(licenseData);

    const { error: updateErr } = await supabase
      .from('license_requests')
      .update({
        status: 'approved',
        license_key: licenseKey,
        expires_at: licenseData.expiresAt,
        features: licenseData.features,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateErr) throw updateErr;

    // Отправка через Telegram (приоритет)
    if (request.telegram_chat_id) {
      const expiry = licenseData.expiresAt
        ? `Срок действия: до ${licenseData.expiresAt}`
        : 'Бессрочная лицензия';
      await sendTelegramMessage(
        request.telegram_chat_id,
        `✅ <b>Ваша лицензия Modulus одобрена!</b>\n\n` +
        `<b>Лицензионный ключ:</b>\n<code>${licenseKey}</code>\n\n` +
        `${expiry}\n\n` +
        `Скопируйте ключ и вставьте его в приложении на экране активации.`,
      ).catch(console.error);
    }

    // Отправка по email (может не работать без домена)
    if (request.email) {
      await sendLicenseEmail(
        request.email,
        request.name,
        request.machine_id,
        licenseKey,
        licenseData.expiresAt,
      ).catch(console.error);
    }

    return cors({ licenseKey });
  } catch (err) {
    console.error(err);
    return cors({ error: 'Ошибка сервера' }, 500);
  }
});
