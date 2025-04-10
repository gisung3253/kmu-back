const TimetableService = require('../services/timetableService');

class TimetableController {
    generateTimetable = async (req, res) => {
        try {
            const params = req.body;
            console.log('Received params:', params); // 디버깅용

            // 필수 파라미터 검증
            const required = ['department', 'grade', 'semester', 'majorCredits', 'liberalCredits', 'liberalAreas'];
            const missing = required.filter(field => !params.hasOwnProperty(field));
            
            if (missing.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Missing required fields: ${missing.join(', ')}`
                });
            }

            const result = await TimetableService.generateTimetable(params);
            return res.json({ success: true, data: result });
        } catch (error) {
            console.error('Error in generateTimetable:', error);
            return res.status(500).json({
                success: false,
                message: error.message || '서버 오류가 발생했습니다.'
            });
        }
    }
}

module.exports = new TimetableController();