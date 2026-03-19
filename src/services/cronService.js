const cron = require('node-cron');
const supabase = require('../config/supabase');
const adminController = require('../controllers/adminController');

/**
 * Scheduled tasks for the CBC eLearning System
 */
const initCronJobs = () => {
  // 1. Annual Student Promotion
  // Run on January 1st at 00:00 every year
  // Format: second minute hour day-of-month month day-of-week
  cron.schedule('0 0 1 1 *', async () => {
    console.log('⏰ Starting scheduled annual student promotion...');
    
    try {
      // We need a mock request/response object to call the controller function
      // or we refactor the logic into a service. 
      // For simplicity here, we'll implement a service-level function or just call the controller logic.
      
      // Let's get all schools first to promote students school by school
      const { data: schools, error: schoolError } = await supabase
        .from('schools')
        .select('id');

      if (schoolError) throw schoolError;

      for (const school of schools) {
        console.log(`Processing school: ${school.id}`);
        // Create a mock req object with the school_id
        const mockReq = { user: { school_id: school.id, role: 'system' } };
        const mockRes = {
          status: () => ({ json: (data) => console.log(`Result for ${school.id}:`, data) }),
          json: (data) => console.log(`Result for ${school.id}:`, data)
        };
        
        await adminController.promoteStudents(mockReq, mockRes);
      }
      
      console.log('✅ Scheduled annual promotion completed successfully.');
    } catch (error) {
      console.error('❌ Scheduled promotion failed:', error);
    }
  });

  console.log('🚀 Cron jobs initialized.');
};

module.exports = { initCronJobs };
