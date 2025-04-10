const TimetableService = require('../services/timetableService');

class TimetableController {
    // 바인딩 문제 해결을 위해 화살표 함수로 변경
    generateTimetable = async (req, res) => {
        try {
            const { 
                department,    // 학과
                grade,        // 학년
                semester,     // 학기
                majorCredits, // 전공 학점
                liberalCredits, // 교양 학점
                liberalAreas  // 교양 영역 선택
            } = req.body;

            // 입력값 검증
            if (!department || !grade || !semester || !majorCredits || !liberalCredits || !liberalAreas) {
                return res.status(400).json({
                    success: false,
                    message: '필수 입력값이 누락되었습니다.'
                });
            }

            // 시간표 생성 서비스 호출
            const result = await TimetableService.generateTimetable({
                department,
                grade,
                semester,
                majorCredits,
                liberalCredits,
                liberalAreas
            });

            // 응답
            return res.status(200).json({
                success: true,
                data: result
            });

        } catch (error) {
            console.error('시간표 생성 중 오류 발생:', error);
            return res.status(500).json({
                success: false,
                message: '서버 오류가 발생했습니다.'
            });
        }
    }
}

module.exports = new TimetableController();