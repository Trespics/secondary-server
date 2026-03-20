const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.use(authorize(['teacher']));

// Dashboard
router.get('/dashboard/stats', teacherController.getDashboardStats);

// Classes & Students
router.get('/classes', teacherController.getMyClasses);
router.get('/students', teacherController.getMyStudents);

// Materials
router.get('/materials', teacherController.getMaterials);
router.post('/materials', teacherController.uploadMaterial);
router.put('/materials/:id', teacherController.updateMaterial);
router.delete('/materials/:id', teacherController.deleteMaterial);

// Past Papers
router.get('/past-papers', teacherController.getPastPapers);
router.post('/past-papers', teacherController.uploadPastPaper);
router.put('/past-papers/:id', teacherController.updatePastPaper);
router.delete('/past-papers/:id', teacherController.deletePastPaper);

// Material Reports
router.get('/material-reports', teacherController.getMaterialReports);
router.put('/material-reports/:id/resolve', teacherController.resolveMaterialReport);

// Assignments
router.get('/assignments', teacherController.getMyAssignments);
router.post('/assignments', teacherController.createAssignment);

// CATs
router.get('/cats', teacherController.getMyCATs);
router.post('/cats', teacherController.createCAT);

// Submissions & Grading
router.get('/submissions', teacherController.getSubmissions);
router.patch('/submissions/:submission_id/grade', teacherController.gradeSubmission);

// Profile
router.get('/profile', teacherController.getProfile);
router.put('/profile', teacherController.updateProfile);

// Notifications
router.get('/notifications', teacherController.getNotifications);

module.exports = router;
