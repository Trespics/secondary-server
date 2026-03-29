const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const examResultsController = require('../controllers/examResultsController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.use(authorize(['student']));

// Profile
router.get('/profile', studentController.getProfile);
router.put('/profile', studentController.updateProfile);

// Subjects
router.get('/subjects', studentController.getSubjects);

// Materials
router.get('/materials', studentController.getMyMaterials);
router.post('/materials/:id/report', studentController.reportMaterial);

// Past Papers
router.get('/past-papers', studentController.getPastPapers);

// Assignments
router.get('/assignments', studentController.getAssignments);
router.post('/submissions', studentController.submitAssignment);

// Grades & Results
router.get('/grades', studentController.getMyGrades);
router.get('/results', studentController.getResults);
router.get('/exam-results', examResultsController.studentGetResults);
router.get('/report-card', studentController.getReportCard);

// Notifications
router.get('/notifications', studentController.getNotifications);

// CATs
router.get('/cats', studentController.getCATs);
router.post('/cats/submit', studentController.submitCAT);

module.exports = router;
