const { sendEmail } = require('./src/services/brevoService');
require('dotenv').config();

async function test() {
  const testEmail = 'johnwarui981@gmail.com'; 
  console.log(`Starting email test to ${testEmail}...`);
  try {
    const result = await sendEmail(
      testEmail,
      'Test Email from Trespics Academy',
      '<h1>Test Successful</h1><p>This is a test email to verify the Brevo configuration.</p>'
    );
    console.log('Test result:', result);
  } catch (error) {
    console.error('Test failed:', error);
  }
}

test();
