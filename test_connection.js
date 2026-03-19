const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Testing connection to:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('Fetching subjects...');
  console.time('fetch-subjects');
  try {
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Supabase Error:', error);
    } else {
      console.log('Success! Data fetched:', data);
    }
  } catch (err) {
    console.error('Caught Error:', err);
    if (err.cause) {
      console.error('Cause:', err.cause);
    }
  } finally {
    console.timeEnd('fetch-subjects');
  }
}

test();
