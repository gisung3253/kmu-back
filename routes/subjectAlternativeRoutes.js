const express = require('express');
const router = express.Router();
const AlternativeController = require('../controllers/subjectAlternativeController');

router.get('/alternatives', AlternativeController.getAlternatives);

module.exports = router;