import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { cors, handleOptions } from '../_shared/cors.ts';
import { generateLicenseKey, LicenseData } from '../_shared/crypto.ts';
import { sendTelegramMessage } from '../_shared/telegram.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOptions(req);

  const password = req.headers.get('x-admin-password');
  if (!password || password !== Deno.env.get('ADMIN_PASSWORD')) {
    return cors(req, { error: 'Unauthorized' }, 401);
  }

  try {
    const { id, expiresAt, features, notify } = await req.json();
    if (!id) return cors(req, { error: 'id обязателен' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: request, error: fetchErr } = await supabase
      .from('license_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !request) return cors(req, { error: 'Запись не найдена' }, 404);

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
        license_key: licenseKey,
        expires_at: licenseData.expiresAt,
        features: licenseData.features,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateErr) throw updateErr;

    // Уведомить пользователя в Telegram если запрошено
    if (notify && request.telegram_chat_id) {
      const expiry = licenseData.expiresAt
        ? `Срок действия: до ${licenseData.expiresAt}`
        : 'Бессрочная лицензия';
      await sendTelegramMessage(
        request.telegram_chat_id,
        `🔄 <b>Ваша лицензия Modulus обновлена</b>\n\n` +
        `<b>Новый лицензионный ключ:</b>\n<code>${licenseKey}</code>\n\n` +
        `${expiry}\n\n` +
        `Введите новый ключ в приложении: Профиль → Обновить лицензию.`,
      ).catch(console.error);
    }

    return cors(req, { licenseKey });
  } catch (err) {
    console.error(err);
    return cors(req, { error: 'Ошибка сервера' }, 500);
  }
});
