const express = require('express');
const router = express.Router();
const TimetableController = require('../controllers/timetableController');

/**
 * POST /api/timetable
 * 시간표 생성 API
 * 
 * Request Body:
 * {
 *   department: string,    // 학과
 *   grade: number,        // 학년
 *   semester: number,     // 학기
 *   majorCredits: number, // 전공 학점
 *   liberalCredits: number, // 교양 학점
 *   liberalAreas: string[]  // 교양 영역 선택
 * }
 */
router.post('/timetable', TimetableController.generateTimetable);

module.exports = router;