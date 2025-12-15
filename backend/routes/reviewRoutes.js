// Arquivo: backend/routes/reviewRoutes.js

const express = require('express');
const router = express.Router();
const { createReview } = require('../controllers/reviewController');
const { protect } = require('../middleware/authMiddleware');

// Define a rota POST /api/reviews
// Ela é protegida pelo 'protect' (que anexa req.patient)
router.post('/', protect, createReview);

module.exports = router;