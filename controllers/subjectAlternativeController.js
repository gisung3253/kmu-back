const AlternativeService = require('../services/subjectAlternativeService');

class AlternativeController {
    getAlternatives = async (req, res) => {
        try {
            const { subjectName, code, isLiberal } = req.query;
            
            const alternatives = await AlternativeService.getAlternatives({
                subjectName,
                code,
                isLiberal: isLiberal === 'true'
            });

            return res.status(200).json({
                success: true,
                data: alternatives
            });
        } catch (error) {
            console.error('대체 과목 조회 중 오류:', error);
            return res.status(500).json({
                success: false,
                message: '서버 오류가 발생했습니다.'
            });
        }
    }
}

module.exports = new AlternativeController();