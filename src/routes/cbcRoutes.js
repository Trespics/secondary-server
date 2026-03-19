const express = require('express');
const router = express.Router();
const cbcController = require('../controllers/cbcController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Curriculum Hierarchy (Accessible by Teacher, Admin)
router.get('/strands', authorize(['teacher', 'admin', 'student']), cbcController.getStrands);
router.post('/strands', authorize(['admin', 'superadmin']), cbcController.createStrand);
router.put('/strands/:id', authorize(['admin', 'superadmin']), cbcController.updateStrand);
router.delete('/strands/:id', authorize(['admin', 'superadmin']), cbcController.deleteStrand);

router.get('/sub-strands', authorize(['teacher', 'admin', 'student']), cbcController.getSubStrands);
router.post('/sub-strands', authorize(['admin', 'superadmin']), cbcController.createSubStrand);
router.put('/sub-strands/:id', authorize(['admin', 'superadmin']), cbcController.updateSubStrand);
router.delete('/sub-strands/:id', authorize(['admin', 'superadmin']), cbcController.deleteSubStrand);

router.get('/learning-outcomes', authorize(['teacher', 'admin', 'student']), cbcController.getLearningOutcomes);
router.post('/learning-outcomes', authorize(['admin', 'superadmin']), cbcController.createLearningOutcome);
router.put('/learning-outcomes/:id', authorize(['admin', 'superadmin']), cbcController.updateLearningOutcome);
router.delete('/learning-outcomes/:id', authorize(['admin', 'superadmin']), cbcController.deleteLearningOutcome);


// Lessons
router.get('/lessons', authorize(['teacher', 'admin', 'student']), cbcController.getLessons);
router.post('/lessons', authorize(['teacher']), cbcController.createLesson);
router.get('/lessons/:id', authorize(['teacher', 'admin', 'student']), cbcController.getLessonDetails);

// Assessments
router.post('/assessments', authorize(['teacher']), cbcController.assessCompetency);
router.get('/assessments/student/:student_id', authorize(['teacher', 'admin', 'student']), cbcController.getStudentCompetencyReport);

// Portfolio
router.post('/portfolio', authorize(['teacher', 'student']), cbcController.uploadPortfolioEvidence);
router.get('/portfolio/student/:student_id', authorize(['teacher', 'admin', 'student']), cbcController.getStudentPortfolio);
router.patch('/portfolio/:id/comment', authorize(['teacher']), cbcController.addPortfolioComment);

module.exports = router;
