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
    const { name, machineId, expiresAt, features, telegramChatId, email } = await req.json();
    if (!name || !machineId) return cors(req, { error: 'name и machineId обязательны' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const licenseData: LicenseData = {
      machineId,
      licensee: name,
      issuedAt: new Date().toISOString().split('T')[0],
      expiresAt: expiresAt ?? null,
      features: features ?? [],
    };

    const licenseKey = await generateLicenseKey(licenseData);

    const { error: insertErr } = await supabase
      .from('license_requests')
      .insert({
        name,
        machine_id: machineId,
        email: email ?? null,
        telegram_chat_id: telegramChatId ?? null,
        status: 'approved',
        license_key: licenseKey,
        expires_at: licenseData.expiresAt,
        features: licenseData.features,
      });

    if (insertErr) throw insertErr;

    // Уведомить в Telegram если указан chat_id
    if (telegramChatId) {
      const expiry = licenseData.expiresAt
        ? `Срок действия: до ${licenseData.expiresAt}`
        : 'Бессрочная лицензия';
      await sendTelegramMessage(
        telegramChatId,
        `✅ <b>Ваша лицензия Modulus выдана!</b>\n\n` +
        `<b>Лицензионный ключ:</b>\n<code>${licenseKey}</code>\n\n` +
        `${expiry}\n\n` +
        `Скопируйте ключ и вставьте его в приложении на экране активации.`,
      ).catch(console.error);
    }

    return cors(req, { licenseKey });
  } catch (err) {
    console.error(err);
    return cors(req, { error: 'Ошибка сервера' }, 500);
  }
});
