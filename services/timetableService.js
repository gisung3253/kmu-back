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
    async getLiberalSubjects(areas) {
        const areaPlaceholders = areas.map(() => '?').join(',');
        const [rows] = await pool.query(
            `SELECT * FROM liberal WHERE area IN (${areaPlaceholders}) ORDER BY ranking ASC`,
            areas
        );
        
        // time_json이 이미 JSON 문자열이므로 파싱하지 않음
        return rows;
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

        // 교양 과목은 liberalCredits가 0보다 큰 경우에만 조회
        let liberalSubjects = [];
        let actualLiberalAreas = [];

        if (liberalCredits > 0) {
            const preferOnline = liberalAreas.includes("원격 강의 희망");
            actualLiberalAreas = liberalAreas.filter(area => area !== "원격강의");
            liberalSubjects = await this.getLiberalSubjects(actualLiberalAreas);
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
            // 기존 교양 과목 선택 로직
            const preferOnline = liberalAreas.includes("원격 강의 희망");

            // 1단계: 원격 강의 우선 선택 (원격강의 선호가 있는 경우)
            if (preferOnline) {
                let onlineCount = 0;  // 원격 강의 수 추적
                
                for (const area of actualLiberalAreas) {
                    if (remainingLiberalCredits <= 0) break;
                    if (onlineCount >= 2) break;  // 원격 강의가 2개 이상이면 중단

                    const onlineSubjects = liberalSubjects
                        .filter(s => s.area === area)
                        .filter(s => !selectedLiberalNames.has(s.name))
                        .filter(s => {
                            const timeJson = typeof s.time_json === 'string' 
                                ? JSON.parse(s.time_json) 
                                : s.time_json;
                            return timeJson[0].day === '원격';
                        });

                    for (const subject of onlineSubjects) {
                        if (remainingLiberalCredits < subject.credit) continue;
                        if (onlineCount >= 2) break;  // 원격 강의가 2개 이상이면 중단

                        result.online.liberal.push(subject);
                        remainingLiberalCredits -= subject.credit;
                        selectedLiberalNames.add(subject.name);
                        areaCount.set(area, (areaCount.get(area) || 0) + 1);
                        onlineCount++;
                        break;
                    }
                }
            }

            const getOnlineCount = (subjects) => {
                return subjects.filter(subject => {
                    const timeJson = typeof subject.time_json === 'string' 
                        ? JSON.parse(subject.time_json) 
                        : subject.time_json;
                    return timeJson[0].day === '원격';
                }).length;
            };

            const canAddOnlineSubject = (subject) => {
                const timeJson = typeof subject.time_json === 'string' 
                    ? JSON.parse(subject.time_json) 
                    : subject.time_json;
                const isOnline = timeJson[0].day === '원격';
                
                if (isOnline) {
                    const currentOnlineCount = getOnlineCount([
                        ...result.online.major, 
                        ...result.online.liberal
                    ]);
                    return currentOnlineCount < 2;
                }
                return true;
            };

            // 2단계: 나머지 과목 선택
            for (const area of actualLiberalAreas) {
                if (remainingLiberalCredits <= 0) break;
                if (areaCount.get(area)) continue; // 이미 해당 영역의 원격 강의가 선택된 경우 스킵

                const areaSubjects = liberalSubjects
                    .filter(s => s.area === area)
                    .filter(s => !selectedLiberalNames.has(s.name));

                for (const subject of areaSubjects) {
                    if (remainingLiberalCredits < subject.credit) continue;

                    const timeJson = typeof subject.time_json === 'string' 
                        ? JSON.parse(subject.time_json) 
                        : subject.time_json;
                        
                    const isOnline = timeJson[0].day === '원격';
                    const targetArray = isOnline ? result.online.liberal : result.offline.liberal;

                    if (canAddSubject(subject, [...result.offline.major, ...result.offline.liberal]) && canAddOnlineSubject(subject)) {
                        targetArray.push(subject);
                        remainingLiberalCredits -= subject.credit;
                        selectedLiberalNames.add(subject.name);
                        areaCount.set(area, (areaCount.get(area) || 0) + 1);
                        break;
                    }
                }
            }

            // 3단계: 남은 학점 채우기
            let liberalAttempts = 0;
            while (remainingLiberalCredits > 0 && liberalAttempts < MAX_ATTEMPTS) {
                let added = false;

                // 영역별 현재 과목 수 확인
                const currentCounts = new Map(areaCount);
                
                // 가장 적은 과목이 선택된 영역부터 선택
                const sortedAreas = [...actualLiberalAreas].sort((a, b) => 
                    (currentCounts.get(a) || 0) - (currentCounts.get(b) || 0)
                );

                for (const area of sortedAreas) {
                    const areaSubjects = liberalSubjects
                        .filter(s => s.area === area)
                        .filter(s => !selectedLiberalNames.has(s.name));

                    for (const subject of areaSubjects) {
                        if (remainingLiberalCredits < subject.credit) continue;

                        const timeJson = typeof subject.time_json === 'string' 
                            ? JSON.parse(subject.time_json) 
                            : subject.time_json;
                            
                        const isOnline = timeJson[0].day === '원격';
                        const targetArray = isOnline ? result.online.liberal : result.offline.liberal;

                        if (canAddSubject(subject, [...result.offline.major, ...result.offline.liberal]) && canAddOnlineSubject(subject)) {
                            targetArray.push(subject);
                            remainingLiberalCredits -= subject.credit;
                            selectedLiberalNames.add(subject.name);
                            areaCount.set(area, (areaCount.get(area) || 0) + 1);
                            added = true;
                            break;
                        }
                    }

                    if (added) break;
                }

                if (!added) {
                    liberalAttempts++;
                    if (liberalAttempts >= MAX_ATTEMPTS) {
                        console.log('교양 과목 시간표 생성 실패: 시간이 겹치지 않는 조합을 찾을 수 없습니다.');
                        break;
                    }
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