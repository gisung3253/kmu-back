const pool = require('../config/database');
const { canAddSubject } = require('../utils/timeValidator');

class TimetableService {
    /**
     * 전공 과목 필터링 및 정렬
     */
    async getMajorSubjects(department, grade, semester) {
        const [rows] = await pool.query(
            'SELECT * FROM major WHERE department = ? AND grade = ? AND semester = ? ORDER BY weight DESC',
            [department, grade, semester]
        );
        
        // time_json이 이미 JSON 문자열이므로 파싱하지 않음
        return rows;
    }

    /**
     * 교양 과목 필터링 및 정렬
     */
    async getLiberalSubjects(areas, isOnlineWanted) {
        const areaPlaceholders = areas.map(() => '?').join(',');
        let query = `SELECT * FROM liberal WHERE area IN (${areaPlaceholders})`;
        
        // 원격 강의 희망하지 않는 경우 원격 강의 제외
        if (!isOnlineWanted) {
            query += ` AND JSON_EXTRACT(time_json, '$[0].day') != '원격'`;
        }
        
        query += ' ORDER BY ranking ASC';
        
        const [rows] = await pool.query(query, areas);
        return rows;
    }

    /**
     * 교양 과목 선택
     */
    async selectLiberalSubjects(result, liberalArea, liberalAreas) {
        // 원격 강의 희망 여부 확인
        const isOnlineWanted = liberalAreas.includes('원격 강의 희망');
        
        let query = `
            SELECT * FROM liberal 
            WHERE area = ?
        `;

        // 원격/비원격 과목 필터링
        if (isOnlineWanted) {
            // 원격 강의를 포함하여 검색
            query += ` ORDER BY ranking ASC`;
        } else {
            // 원격 강의 제외
            query += ` AND JSON_EXTRACT(time_json, '$[0].day') != '원격' ORDER BY ranking ASC`;
        }

        const [subjects] = await pool.query(query, [liberalArea]);

        // 원격 강의와 오프라인 강의 분리
        const offlineSubjects = [];
        const onlineSubjects = [];

        for (const subject of subjects) {
            const timeJson = JSON.parse(subject.time_json);
            if (timeJson[0].day === '원격') {
                onlineSubjects.push(subject);
            } else {
                offlineSubjects.push(subject);
            }
        }

        // 원격 강의는 online.liberal에, 오프라인 강의는 offline.liberal에 추가
        if (isOnlineWanted) {
            result.online.liberal.push(...onlineSubjects);
        }
        result.offline.liberal.push(...offlineSubjects);

        return subjects;
    }

    /**
     * 시간표 생성
     */
    async generateTimetable(params) {
        const { 
            department, 
            grade, 
            semester, 
            majorCredits, 
            liberalCredits,
            liberalAreas 
        } = params;

        // 원격 강의 희망 여부 확인
        const isOnlineWanted = liberalAreas.includes('원격 강의 희망');
        
        // 교양 영역에서 '원격 강의 희망' 제외
        const actualLiberalAreas = liberalAreas.filter(area => area !== '원격 강의 희망');

        // 교양 과목 조회
        let liberalSubjects = [];
        if (liberalCredits > 0) {
            liberalSubjects = await this.getLiberalSubjects(actualLiberalAreas, isOnlineWanted);
        }

        // 전공 과목 조회
        const majorSubjects = await this.getMajorSubjects(department, grade, semester);

        const result = {
            offline: { major: [], liberal: [] },
            online: { major: [], liberal: [] }
        };

        // 전공 과목 선택 시도 횟수 제한
        let majorAttempts = 0;
        const MAX_ATTEMPTS = 100; // 최대 시도 횟수

        // 전공 과목 선택 (중복 이름 제거)
        let remainingMajorCredits = majorCredits;
        const selectedMajorNames = new Set();

        while (remainingMajorCredits > 0 && majorAttempts < MAX_ATTEMPTS) {
            let added = false;
            
            for (const subject of majorSubjects) {
                if (selectedMajorNames.has(subject.name)) continue;

                const timeJson = typeof subject.time_json === 'string' 
                    ? JSON.parse(subject.time_json) 
                    : subject.time_json;
                    
                const isOnline = timeJson[0].day === '원격';
                const targetArray = isOnline ? result.online.major : result.offline.major;

                if (canAddSubject(subject, [...result.offline.major, ...result.offline.liberal])) {
                    targetArray.push(subject);
                    remainingMajorCredits -= subject.credit;
                    selectedMajorNames.add(subject.name);
                    added = true;
                    break;
                }
            }

            // 한 번의 순회에서 아무 과목도 추가하지 못했다면
            if (!added) {
                majorAttempts++;
                // 모든 시도가 실패하면
                if (majorAttempts >= MAX_ATTEMPTS) {
                    console.log('전공 과목 시간표 생성 실패: 시간이 겹치지 않는 조합을 찾을 수 없습니다.');
                    break;
                }
            }
        }

        // 교양 과목 선택을 위한 Set 추가
        const selectedLiberalNames = new Set();

        // 교양 과목 선택 로직 (liberalCredits > 0 인 경우에만 실행)
        let areaCount = new Map();
        let remainingLiberalCredits = liberalCredits;

        if (liberalCredits > 0) {
            let onlineCount = 0;
            const MAX_ONLINE = isOnlineWanted ? 2 : 0;  // 원격 강의 희망 시에만 최대 2개
            
            // 교양 과목을 온라인과 오프라인으로 분리
            const onlineSubjects = [];
            const offlineSubjects = [];
            
            // 과목 분류
            for (const subject of liberalSubjects) {
                const timeJson = typeof subject.time_json === 'string' 
                    ? JSON.parse(subject.time_json) 
                    : subject.time_json;
                    
                if (timeJson[0].day === '원격') {
                    onlineSubjects.push(subject);
                } else {
                    offlineSubjects.push(subject);
                }
            }
            
            // 온라인 과목 먼저 처리 (원격 강의 희망 시)
            if (isOnlineWanted) {
                for (const subject of onlineSubjects) {
                    // 이름 중복 체크 추가
                    if (selectedLiberalNames.has(subject.name)) continue;
                    if (onlineCount >= MAX_ONLINE || remainingLiberalCredits < subject.credit) continue;
                    
                    result.online.liberal.push(subject);
                    remainingLiberalCredits -= subject.credit;
                    selectedLiberalNames.add(subject.name);
                    areaCount.set(subject.area, (areaCount.get(subject.area) || 0) + 1);
                    onlineCount++;
                }
            }
            
            // 오프라인 과목 처리
            for (const subject of offlineSubjects) {
                if (remainingLiberalCredits < subject.credit) continue;
                
                if (canAddSubject(subject, [...result.offline.major, ...result.offline.liberal])) {
                    result.offline.liberal.push(subject);
                    remainingLiberalCredits -= subject.credit;
                    selectedLiberalNames.add(subject.name);
                    areaCount.set(subject.area, (areaCount.get(subject.area) || 0) + 1);
                }
            }
        }

        // 최종 결과에 메타데이터 추가
        const actualMajorCredits = majorCredits - remainingMajorCredits;
        const actualLiberalCredits = liberalCredits > 0 ? liberalCredits - remainingLiberalCredits : 0;
        const success = (
            actualMajorCredits === majorCredits &&
            actualLiberalCredits === liberalCredits
        );

        const meta = {
            requestedMajorCredits: majorCredits,
            actualMajorCredits,
            requestedLiberalCredits: liberalCredits,
            actualLiberalCredits,
            success,
            areaDistribution: liberalCredits > 0 ? Object.fromEntries(areaCount) : {}
        };

        return {
            ...result,
            meta
        };
    }
}

module.exports = new TimetableService();