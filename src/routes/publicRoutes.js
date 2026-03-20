const express = require('express');
const { submitContactForm, subscribeNewsletter } = require('../controllers/publicController');

const router = express.Router();

// Contact form submission
router.post('/contact', submitContactForm);

// Newsletter subscription
router.post('/newsletter', subscribeNewsletter);

module.exports = router;
