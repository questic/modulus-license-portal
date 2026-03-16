import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { cors, handleOptions } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOptions();

  const password = req.headers.get('x-admin-password');
  if (!password || password !== Deno.env.get('ADMIN_PASSWORD')) {
    return cors({ error: 'Unauthorized' }, 401);
  }

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let query = supabase
      .from('license_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return cors(data);
  } catch (err) {
    console.error(err);
    return cors({ error: 'Ошибка сервера' }, 500);
  }
});
