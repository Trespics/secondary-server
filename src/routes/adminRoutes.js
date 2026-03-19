const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.use(authorize(['admin']));

// Dashboard
router.get('/dashboard/stats', adminController.getDashboardStats);

// Profile
router.get('/profile', adminController.getProfile);
router.put('/profile', adminController.updateProfile);

// Users
router.get('/users', adminController.getUsers);
router.post('/users', adminController.registerUser);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);

// School
router.get('/school', adminController.getSchool);
router.put('/school', adminController.updateSchool);

// Announcements
router.get('/announcements', adminController.getAnnouncements);
router.post('/announcements', adminController.createAnnouncement);
router.delete('/announcements/:id', adminController.deleteAnnouncement);

// Materials / Content Moderation
router.get('/materials', adminController.getMaterials);
router.put('/materials/:id/flag', adminController.flagMaterial);
router.put('/materials/:id/unflag', adminController.unflagMaterial);

// Past Paper Moderation
router.get('/past-papers', adminController.getPastPapers);
router.put('/past-papers/:id/flag', adminController.flagPastPaper);
router.put('/past-papers/:id/unflag', adminController.unflagPastPaper);
router.delete('/past-papers/:id', adminController.deletePastPaperModeration);

// Classes & Subjects
router.get('/classes', adminController.getClasses);
router.post('/classes', adminController.createClass);   
router.put('/classes/:id', adminController.updateClass);
router.delete('/classes/:id', adminController.deleteClass);

router.get('/subjects', adminController.getSubjects);
router.post('/subjects', adminController.createSubject);
router.put('/subjects/:id', adminController.updateSubject);
router.delete('/subjects/:id', adminController.deleteSubject);

// Teacher-Subject Assignments
router.get('/teacher-assignments', adminController.getTeacherAssignments);
router.post('/teacher-assignments', adminController.assignTeacherToClass);
router.delete('/teacher-assignments/:id', adminController.removeTeacherAssignment);

// Student Enrollments
router.get('/enrollments', adminController.getEnrollments);
router.post('/enrollments', adminController.enrollStudent);
router.post('/enrollments/promote-all', adminController.promoteStudents);
router.delete('/enrollments/:id', adminController.unenrollStudent);

// Materials Management (CRUD)
router.post('/materials', adminController.createMaterial);
router.put('/materials/:id', adminController.updateMaterial);
router.delete('/materials/:id', adminController.deleteMaterial);

// Activity Logs
router.get('/activity-logs', adminController.getActivityLogs);

// CBC Curriculum Loading
router.get('/strands', adminController.getStrands); // Shared from cbcController conceptually but if we want specific admin logic:
router.post('/strands', adminController.createStrand);
router.put('/strands/:id', adminController.updateStrand);
router.delete('/strands/:id', adminController.deleteStrand);

router.get('/sub-strands', adminController.getSubStrands);
router.post('/sub-strands', adminController.createSubStrand);
router.put('/sub-strands/:id', adminController.updateSubStrand);
router.delete('/sub-strands/:id', adminController.deleteSubStrand);

router.get('/learning-outcomes', adminController.getLearningOutcomes);
router.post('/learning-outcomes', adminController.createLearningOutcome);
router.put('/learning-outcomes/:id', adminController.updateLearningOutcome);
router.delete('/learning-outcomes/:id', adminController.deleteLearningOutcome);

// Grade-level Subjects (Automatic Enrollment)
router.get('/grade-subjects', adminController.getGradeSubjects);
router.post('/grade-subjects', adminController.assignSubjectToGrade);
router.delete('/grade-subjects/:id', adminController.removeGradeSubject);

module.exports = router;
