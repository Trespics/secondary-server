const express = require('express');
const router = express.Router();
const superAdminController = require('../controllers/superAdminController');
const { authenticate, authorize } = require('../middleware/auth');

// Public Setup Routes
router.get('/check-setup', superAdminController.checkSetup);
router.post('/setup', superAdminController.setupInitialSuperAdmin);

// All other routes here require superadmin role
router.use(authenticate);
router.use(authorize(['superadmin']));

// Profile
router.get('/profile', superAdminController.getProfile);
router.put('/profile', superAdminController.updateProfile);

// School Management
router.post('/schools', superAdminController.createSchool);
router.get('/schools', superAdminController.getSchools);
router.put('/schools/:id', superAdminController.updateSchool);
router.delete('/schools/:id', superAdminController.deleteSchool);

// School Admin Management
router.post('/register-admin', superAdminController.registerSchoolAdmin);
router.get('/admins', superAdminController.getSchoolAdmins);

// Subject Management
router.get('/subjects', superAdminController.getSubjects);
router.post('/subjects', superAdminController.createSubject);
router.put('/subjects/:id', superAdminController.updateSubject);
router.delete('/subjects/:id', superAdminController.deleteSubject);

// Class & Assignment Management
router.get('/classes', superAdminController.getClasses);
router.get('/assignments', superAdminController.getAssignments);
router.post('/assignments', superAdminController.assignSubjectToClass);
router.delete('/assignments/:id', superAdminController.removeAssignment);

// Dashboard Stats
router.get('/stats', superAdminController.getSuperAdminStats);

// Contact Messages
router.get('/contact-messages', superAdminController.getContactMessages);
router.post('/contact-messages/:id/reply', superAdminController.replyToContactMessage);

module.exports = router;

