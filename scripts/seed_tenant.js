require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("Seeding mock tenant...");
  const { data, error } = await supabase.from('tenants').upsert({
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Delhi Public School',
    city: 'New Delhi',
    subscription_tier: 'growth'
  });
  
  if (error) {
    console.error("Error setting up tenant:", error);
  } else {
    console.log("Tenant successfully seeded.");
  }
}

run();
