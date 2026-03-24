const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLastUser() {
  console.log('Fetching last registered users...');
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (error) {
    console.error('Error fetching users:', error);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

checkLastUser();
