import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { cors, handleOptions } from '../_shared/cors.ts';
import { sendRequestConfirmation, sendAdminNotification } from '../_shared/email.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOptions();

  try {
    const { name, email, machineId } = await req.json();

    if (!name || !email || !machineId) {
      return cors({ error: 'Заполните все обязательные поля' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data, error } = await supabase
      .from('license_requests')
      .insert({ name, email, machine_id: machineId })
      .select('id')
      .single();

    if (error) throw error;

    // Письмо пользователю
    await sendRequestConfirmation(name, email, machineId).catch(console.error);

    // Уведомление администратору
    const adminEmail = Deno.env.get('ADMIN_EMAIL');
    const adminUrl = Deno.env.get('ADMIN_URL') ?? '';
    if (adminEmail) {
      await sendAdminNotification(adminEmail, name, email, machineId, adminUrl).catch(console.error);
    }

    return cors({ id: data.id });
  } catch (err) {
    console.error(err);
    return cors({ error: 'Ошибка сервера' }, 500);
  }
});
