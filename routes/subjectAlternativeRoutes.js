const express = require('express');
const router = express.Router();
const SubjectAlternativeController = require('../controllers/subjectAlternativeController');

router.get('/alternatives', SubjectAlternativeController.getAlternatives);
// 대체 시간표 추천 API 추가
router.post('/alternatives/recommend', SubjectAlternativeController.recommendAlternativeTimetable);

module.exports = router;