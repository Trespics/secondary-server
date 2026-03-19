const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL and Service Role Key are required in .env');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: { 'x-application-name': 'cbc-elearning' }
  }
});

// Helper for retrying failed database operations (handles transient 500 errors)
const safeQuery = async (queryFn, retries = 5, delay = 1000) => {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      const result = await queryFn();
      
      // Handle the case where Supabase returns an error object without throwing
      if (result.error) {
        // PGRST116 is "not found", which is a client error, not a retryable server error
        if (result.error.code === 'PGRST116') return result;
        
        // Retry on 500+ or network-related code (or no code which often means fetch failed)
        if (result.error.status >= 500 || !result.error.code || result.error.message.includes('fetch failed')) {
          throw result.error;
        }
        return result; // Other errors (4xx) are likely permanent
      }
      return result;
    } catch (error) {
      lastError = error;
      const isTimeout = error.message?.includes('Timeout') || error.name === 'ConnectTimeoutError';
      const errorType = isTimeout ? 'TIMEOUT' : 'FETCH_ERROR';
      
      console.warn(`⚠️ Supabase ${errorType} (attempt ${i + 1}/${retries}). Retrying in ${delay}ms...`);
      if (i < retries - 1) {
        await new Promise(res => setTimeout(res, delay + Math.random() * 500));
        delay *= 2; // Exponential backoff
      }
    }
  }
  console.error(`❌ Supabase query failed permanently after ${retries} attempts.`);
  return { data: null, error: lastError };
};

module.exports = supabase;
module.exports.safeQuery = safeQuery;
