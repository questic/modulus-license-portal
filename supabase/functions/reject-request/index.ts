import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { cors, handleOptions } from '../_shared/cors.ts';
import { sendRejectionEmail } from '../_shared/email.ts';
import { sendTelegramMessage } from '../_shared/telegram.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOptions(req);

  const password = req.headers.get('x-admin-password');
  if (!password || password !== Deno.env.get('ADMIN_PASSWORD')) {
    return cors(req, { error: 'Unauthorized' }, 401);
  }

  try {
    const { id } = await req.json();
    if (!id) return cors(req, { error: 'id обязателен' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: request, error: fetchErr } = await supabase
      .from('license_requests')
      .select('name, email, telegram_chat_id')
      .eq('id', id)
      .single();

    if (fetchErr || !request) return cors(req, { error: 'Заявка не найдена' }, 404);

    const { error: updateErr } = await supabase
      .from('license_requests')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateErr) throw updateErr;

    // Уведомление через Telegram (приоритет)
    if (request.telegram_chat_id) {
      await sendTelegramMessage(
        request.telegram_chat_id,
        `❌ <b>Заявка на лицензию Modulus отклонена.</b>\n\n` +
        `Если у вас есть вопросы, свяжитесь с нами.`,
      ).catch(console.error);
    }

    // Уведомление по email (может не работать без домена)
    if (request.email) {
      await sendRejectionEmail(request.email, request.name).catch(console.error);
    }

    return cors(req, { ok: true });
  } catch (err) {
    console.error(err);
    return cors(req, { error: 'Ошибка сервера' }, 500);
  }
});
