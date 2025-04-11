const pool = require('../config/database');

class SubjectAlternativeService {
    async findAlternatives(code) {
        try {
            // 현재 과목 정보 조회
            let currentSubject;
            let [majorSubject] = await pool.query(
                'SELECT *, "major" as type FROM major WHERE code = ?',
                [code]
            );

            if (majorSubject.length === 0) {
                let [liberalSubject] = await pool.query(
                    'SELECT *, "liberal" as type FROM liberal WHERE code = ?',
                    [code]
                );
                
                if (liberalSubject.length === 0) {
                    throw new Error('과목을 찾을 수 없습니다.');
                }
                currentSubject = liberalSubject[0];
            } else {
                currentSubject = majorSubject[0];
            }

            // 현재 과목의 시간 정보 추출
            const currentTime = currentSubject.time_json[0];

            // 대체 가능한 과목 조회
            const tableName = currentSubject.type === 'major' ? 'major' : 'liberal';
            let query;
            let params;

            if (tableName === 'major') {
                query = `SELECT * FROM major
                    WHERE name = ? 
                    AND semester = ? 
                    AND code != ?
                    AND JSON_EXTRACT(time_json, '$[0].day') = ?
                    AND JSON_EXTRACT(time_json, '$[0].start') = ?
                    AND JSON_EXTRACT(time_json, '$[0].end') = ?`;
                params = [
                    currentSubject.name,
                    currentSubject.semester,
                    code,
                    currentTime.day,
                    currentTime.start,
                    currentTime.end
                ];
            } else {
                query = `SELECT * FROM liberal
                    WHERE name = ? 
                    AND code != ?
                    AND JSON_EXTRACT(time_json, '$[0].day') = ?
                    AND JSON_EXTRACT(time_json, '$[0].start') = ?
                    AND JSON_EXTRACT(time_json, '$[0].end') = ?`;
                params = [
                    currentSubject.name,
                    code,
                    currentTime.day,
                    currentTime.start,
                    currentTime.end
                ];
            }

            const [alternatives] = await pool.query(query, params);

            return {
                current: currentSubject,
                alternatives: alternatives
            };
        } catch (error) {
            console.error('Error in findAlternatives:', error);
            throw error;
        }
    }

    async recommendAlternativeTimetable(excludedCodes) {
        try {
            // 1. 현재 시간표의 과목들 조회
            const currentSubjects = await this.getSubjectsInfo(excludedCodes);
            
            // 2. 과목 분류
            const majorSubjects = currentSubjects.filter(s => s.type === 'major');
            const onlineSubjects = currentSubjects.filter(s => {
                const timeJson = typeof s.time_json === 'string' 
                    ? JSON.parse(s.time_json) 
                    : s.time_json;
                return timeJson[0].day === '원격';
            });
            const offlineLiberalSubjects = currentSubjects.filter(s => {
                const timeJson = typeof s.time_json === 'string' 
                    ? JSON.parse(s.time_json) 
                    : s.time_json;
                return s.type === 'liberal' && timeJson[0].day !== '원격';
            });

            // 3. 결과 초기화 (전공과 원격은 그대로 유지)
            const result = {
                offline: {
                    major: majorSubjects,
                    liberal: []
                },
                online: {
                    major: onlineSubjects.filter(s => s.type === 'major'),
                    liberal: onlineSubjects.filter(s => s.type === 'liberal')
                }
            };

            // 4. 각 오프라인 교양 과목에 대해 다음 순위 과목으로 교체 시도
            for (const liberal of offlineLiberalSubjects) {
                const nextRankedLiberals = await this.getNextRankedLiberals(liberal);
                
                // 다음 순위 과목들 중 시간이 안 겹치는 첫 번째 과목 선택
                let replaced = false;
                for (const alt of nextRankedLiberals) {
                    if (this.isValidReplacement(alt, result)) {
                        result.offline.liberal.push(alt);
                        replaced = true;
                        break;
                    }
                }

                // 교체 가능한 과목이 없으면 원래 과목 유지
                if (!replaced) {
                    result.offline.liberal.push(liberal);
                }
            }

            return result;
        } catch (error) {
            console.error('Error in recommendAlternativeTimetable:', error);
            throw error;
        }
    }

    async getNextRankedLiberals(currentLiberal) {
        // 현재 과목보다 낮은 순위의 같은 영역 오프라인 교양 과목들만 조회
        const [alternatives] = await pool.query(
            `SELECT * FROM liberal 
            WHERE area = ? 
            AND ranking > ?
            AND JSON_EXTRACT(time_json, '$[0].day') != '원격'
            ORDER BY ranking ASC`,
            [currentLiberal.area, currentLiberal.ranking]
        );
        
        return alternatives;
    }

    isValidReplacement(newSubject, currentTimetable) {
        const allSubjects = [
            ...currentTimetable.offline.major,
            ...currentTimetable.offline.liberal,
            ...currentTimetable.online.major,
            ...currentTimetable.online.liberal
        ];

        return !this.hasTimeConflict(newSubject, allSubjects);
    }

    async findValidAlternative(subject, excludedCodes, currentTimetable) {
        const tableName = subject.type === 'major' ? 'major' : 'liberal';
        let query;
        let params;

        if (tableName === 'major') {
            query = `
                SELECT * FROM major
                WHERE semester = ?
                AND credit = ?
                AND code NOT IN (?)
                AND code != ?
            `;
            params = [subject.semester, subject.credit, excludedCodes, subject.code];
        } else {
            query = `
                SELECT * FROM liberal
                WHERE credit = ?
                AND area = ?
                AND code NOT IN (?)
                AND code != ?
            `;
            params = [subject.credit, subject.area, excludedCodes, subject.code];
        }

        const [alternatives] = await pool.query(query, params);
        return alternatives;
    }

    hasTimeConflict(subject1, subjects) {
        try {
            const time1 = Array.isArray(subject1.time_json) 
                ? subject1.time_json 
                : JSON.parse(subject1.time_json);
            
            for (const subject2 of subjects) {
                if (!subject2.time_json) continue;
                
                const time2 = Array.isArray(subject2.time_json)
                    ? subject2.time_json
                    : JSON.parse(subject2.time_json);
                
                for (const t1 of time1) {
                    for (const t2 of time2) {
                        if (t1.day === t2.day &&
                            this.timeOverlaps(t1.start, t1.end, t2.start, t2.end)) {
                            return true;
                        }
                    }
                }
            }
            return false;
        } catch (error) {
            console.error('Time conflict check error:', error);
            return true; // 에러 발생 시 충돌로 간주
        }
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    timeOverlaps(start1, end1, start2, end2) {
        return (start1 < end2 && end1 > start2);
    }

    async getSubjectsInfo(codes) {
        const subjects = [];
        
        for (const code of codes) {
            // 전공/교양 테이블에서 과목 정보 조회
            let [majorSubject] = await pool.query('SELECT *, "major" as type FROM major WHERE code = ?', [code]);
            if (majorSubject.length > 0) {
                subjects.push(majorSubject[0]);
                continue;
            }

            let [liberalSubject] = await pool.query('SELECT *, "liberal" as type FROM liberal WHERE code = ?', [code]);
            if (liberalSubject.length > 0) {
                subjects.push(liberalSubject[0]);
            }
        }
        
        return subjects;
    }

    analyzeSubjects(subjects) {
        return {
            majorCount: subjects.filter(s => s.type === 'major').length,
            liberalCount: subjects.filter(s => s.type === 'liberal').length,
            department: subjects.find(s => s.type === 'major')?.department,
            semester: subjects[0].semester,
            liberalAreas: [...new Set(subjects
                .filter(s => s.type === 'liberal')
                .map(s => s.area))]
        };
    }
}

module.exports = new SubjectAlternativeService();