import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { cors, handleOptions } from '../_shared/cors.ts';
import { sendAdminNotification } from '../_shared/email.ts';
import {
  getClientIp,
  isValidMachineId,
  normalizeMachineId,
  verifyTurnstileToken,
} from '../_shared/security.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOptions(req);

  try {
    const {
      name,
      email,
      telegramChatId,
      machineId,
      turnstileToken,
      company,
    } = await req.json();

    if (!name || !machineId) {
      return cors(req, { error: 'Заполните все обязательные поля' }, 400);
    }
    if (!email && !telegramChatId) {
      return cors(req, { error: 'Укажите e-mail или Telegram Chat ID' }, 400);
    }
    if (company) {
      return cors(req, { error: 'Запрос отклонён' }, 400);
    }

    const normalizedMachineId = normalizeMachineId(machineId);
    if (!isValidMachineId(normalizedMachineId)) {
      return cors(req, { error: 'Некорректный Machine ID' }, 400);
    }

    const turnstileOk = await verifyTurnstileToken(req, turnstileToken);
    if (!turnstileOk) {
      return cors(req, { error: 'Не пройдена проверка безопасности' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const clientIp = getClientIp(req);
    const userAgent = req.headers.get('user-agent');

    const { data: existingPending, error: pendingErr } = await supabase
      .from('license_requests')
      .select('id')
      .eq('machine_id', normalizedMachineId)
      .eq('status', 'pending')
      .maybeSingle();

    if (pendingErr) throw pendingErr;
    if (existingPending) {
      return cors(req, { error: 'Для этого Machine ID уже есть заявка в обработке' }, 409);
    }

    if (clientIp) {
      const rateWindowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count, error: rateErr } = await supabase
        .from('license_requests')
        .select('id', { count: 'exact', head: true })
        .eq('request_ip', clientIp)
        .gte('created_at', rateWindowStart);

      if (rateErr) throw rateErr;
      if ((count ?? 0) >= 5) {
        return cors(req, { error: 'Слишком много заявок. Повторите позже.' }, 429);
      }
    }

    const { data, error } = await supabase
      .from('license_requests')
      .insert({
        name,
        email: email || null,
        telegram_chat_id: telegramChatId || null,
        machine_id: normalizedMachineId,
        request_ip: clientIp,
        user_agent: userAgent,
      })
      .select('id')
      .single();

    if (error) throw error;

    // Уведомление администратору по email (может не работать без домена)
    const adminEmail = Deno.env.get('ADMIN_EMAIL');
    const adminUrl = Deno.env.get('ADMIN_URL') ?? '';
    if (adminEmail) {
      await sendAdminNotification(adminEmail, name, email ?? '—', normalizedMachineId, adminUrl).catch(console.error);
    }

    return cors(req, { id: data.id });
  } catch (err) {
    console.error(err);
    return cors(req, { error: 'Ошибка сервера' }, 500);
  }
});
