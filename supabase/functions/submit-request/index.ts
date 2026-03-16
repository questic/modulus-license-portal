import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { cors, handleOptions } from '../_shared/cors.ts';
import { sendAdminNotification } from '../_shared/email.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOptions();

  try {
    const { name, email, telegramChatId, machineId } = await req.json();

    if (!name || !machineId) {
      return cors({ error: 'Заполните все обязательные поля' }, 400);
    }
    if (!email && !telegramChatId) {
      return cors({ error: 'Укажите e-mail или Telegram Chat ID' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data, error } = await supabase
      .from('license_requests')
      .insert({
        name,
        email: email || null,
        telegram_chat_id: telegramChatId || null,
        machine_id: machineId,
      })
      .select('id')
      .single();

    if (error) throw error;

    // Уведомление администратору по email (может не работать без домена)
    const adminEmail = Deno.env.get('ADMIN_EMAIL');
    const adminUrl = Deno.env.get('ADMIN_URL') ?? '';
    if (adminEmail) {
      await sendAdminNotification(adminEmail, name, email ?? '—', machineId, adminUrl).catch(console.error);
    }

    return cors({ id: data.id });
  } catch (err) {
    console.error(err);
    return cors({ error: 'Ошибка сервера' }, 500);
  }
});
