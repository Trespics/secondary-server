const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const parentController = require('../controllers/parentController');

// All routes require authentication as parent
router.use(authenticate);
router.use(authorize(['parent']));

// Profile
router.get('/profile', parentController.getProfile);
router.put('/profile/setup', parentController.setupParentProfile);

// Students
router.get('/students', parentController.getStudents);
router.get('/students/:studentId/performance', parentController.getStudentPerformance);
router.get('/students/:studentId/report-card', parentController.getStudentReportCard);

// Dashboard
router.get('/dashboard/stats', parentController.getDashboardStats);

// Notifications
router.get('/notifications', parentController.getNotifications);
router.put('/notifications/:id/read', parentController.markNotificationRead);

// Messages
router.get('/teachers', parentController.getTeachers);
router.get('/messages', parentController.getMessages);
router.get('/messages/:teacherId', parentController.getConversation);
router.post('/messages', parentController.sendMessage);
router.put('/messages/:id/read', parentController.markMessageRead);

module.exports = router;
