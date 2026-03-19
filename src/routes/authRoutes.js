const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Public routes — no auth middleware
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Protected routes
const { authenticate } = require('../middleware/auth');
router.post('/change-password', authenticate, authController.changePassword);

module.exports = router;
