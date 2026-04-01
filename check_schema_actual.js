const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkSchema() {
  const { data: tables, error: tableError } = await supabase
    .from('pg_catalog.pg_tables')
    .select('tablename')
    .eq('schemaname', 'public');

  if (tableError) {
    console.error('Error fetching tables:', tableError);
  } else {
    console.log('Tables in public schema:', tables.map(t => t.tablename).join(', '));
  }

  const { data: enumValues, error: enumError } = await supabase
    .rpc('get_enum_values', { enum_name: 'user_role' });

  // If RPC is not available, try a raw query if possible, or just check columns of parent_messages
  if (enumError) {
    console.log('Could not fetch enum values via RPC, trying to check parent_messages table structure');
    const { data: columns, error: colError } = await supabase
      .from('parent_messages')
      .select('*')
      .limit(1);
    
    if (colError) {
        console.error('Error fetching parent_messages:', colError);
    } else {
        console.log('parent_messages table exists.');
    }
  } else {
    console.log('user_role enum values:', enumValues);
  }
}

checkSchema();
