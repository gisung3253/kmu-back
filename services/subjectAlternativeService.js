const pool = require('../config/database');

class SubjectAlternativeService {
    async getAlternatives(params) {
        const { subjectName, code, subjectType } = params;
        try {
            // 전공/교양 테이블 선택
            const table = subjectType === 'major' ? 'major' : 'liberal';
            
            const [alternatives] = await pool.query(
                `SELECT * FROM ${table} WHERE name = ? AND code != ?`,
                [subjectName, code]
            );

            return alternatives;
        } catch (error) {
            console.error('대체 과목 조회 중 오류 발생:', error);
            throw error;
        }
    }
}

module.exports = new SubjectAlternativeService();