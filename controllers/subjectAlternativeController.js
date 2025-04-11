const SubjectAlternativeService = require('../services/subjectAlternativeService');

class SubjectAlternativeController {
    getAlternatives = async (req, res) => {
        try {
            const { code } = req.query;

            if (!code) {
                return res.status(400).json({
                    success: false,
                    message: '과목 코드가 필요합니다.'
                });
            }

            const alternatives = await SubjectAlternativeService.findAlternatives(code);
            return res.json({
                success: true,
                data: alternatives
            });
        } catch (error) {
            console.error('Error in getAlternatives:', error);
            return res.status(500).json({
                success: false,
                message: error.message || '대체 과목 조회 중 오류가 발생했습니다.'
            });
        }
    }

    recommendAlternativeTimetable = async (req, res) => {
        try {
            const { excludedCodes } = req.body;

            if (!Array.isArray(excludedCodes)) {
                return res.status(400).json({
                    success: false,
                    message: '과목 코드 목록이 필요합니다.'
                });
            }

            const result = await SubjectAlternativeService.recommendAlternativeTimetable(excludedCodes);
            return res.json({
                success: true,
                data: result
            });
        } catch (error) {
            console.error('Error in recommendAlternativeTimetable:', error);
            return res.status(500).json({
                success: false,
                message: error.message || '시간표 추천 중 오류가 발생했습니다.'
            });
        }
    }
}

module.exports = new SubjectAlternativeController();