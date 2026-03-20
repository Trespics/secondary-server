const express = require('express');
const router = express.Router();
const libraryController = require('../controllers/libraryController');
const { authenticate, authorize } = require('../middleware/auth');

// Public or Authenticated generic routes
router.use(authenticate);

// Search & Discovery
router.get('/categories', libraryController.getCategories);
router.get('/items', libraryController.getItems);
router.get('/items/:id', libraryController.getItemById);

// User Features
router.post('/favorites', libraryController.toggleFavorite);
router.get('/favorites', libraryController.getFavorites);
router.post('/reviews', libraryController.addReview);
router.post('/progress', libraryController.updateProgress);
router.get('/progress', libraryController.getProgress);

// Admin / Superadmin features
router.post('/items', authorize(['superadmin']), libraryController.createItem);
router.put('/items/:id', authorize(['superadmin']), libraryController.updateItem);
router.delete('/items/:id', authorize(['superadmin']), libraryController.deleteItem);

module.exports = router;
