import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const email = 'manager.insights.demo@example.com';

  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });

  if (error) throw error;

  const user = data.users.find(
    u => u.email?.toLowerCase() === email
  );

  if (!user) {
    console.log('Account not found');
    return;
  }

  console.log('Complete user ID:', user.id);

  const { data: profile, error: updateError } = await supabase
    .from('profiles')
    .update({ role: 'manager' })
    .eq('id', user.id)
    .select('id,email,role');

  if (updateError) throw updateError;

  console.log('Updated profile:', profile);
}

main().catch(console.error);
