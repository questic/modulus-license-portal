import { sendTelegramMessage } from '../_shared/telegram.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok');

  try {
    const update = await req.json();
    const message = update.message;
    if (!message) return new Response('ok');

    const chatId = String(message.chat.id);
    const text = message.text ?? '';

    if (text.startsWith('/start')) {
      await sendTelegramMessage(
        chatId,
        `Ваш Telegram Chat ID:\n\n<code>${chatId}</code>\n\nСкопируйте это число и вставьте в форму заявки на лицензию Modulus.`,
      );
    }
  } catch (err) {
    console.error(err);
  }

  return new Response('ok');
});
