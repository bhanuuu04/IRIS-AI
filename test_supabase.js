require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpsert() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 1);

  const { data, error } = await supabase
    .from('users')
    .upsert(
      {
        clerk_id: 'test_user_123',
        pro_mode_active: true,
        subscription_expires_at: expiresAt.toISOString(),
      },
      { onConflict: 'clerk_id' }
    );

  console.log('Error:', error);
  console.log('Data:', data);
}

testUpsert();
