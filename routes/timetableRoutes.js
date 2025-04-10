const express = require('express');
const router = express.Router();
const TimetableController = require('../controllers/timetableController');

router.post('/timetable', TimetableController.generateTimetable);

module.exports = router;