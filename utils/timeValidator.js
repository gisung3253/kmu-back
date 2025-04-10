/**
 * 과목 리스트에서 원격 강의 수를 확인하는 함수
 */
function countOnlineCourses(subjects) {
    return subjects.filter(subject => {
        const timeJson = typeof subject.time_json === 'string' 
            ? JSON.parse(subject.time_json) 
            : subject.time_json;
        return timeJson[0].day === '원격';
    }).length;
}

/**
 * 두 시간이 겹치는지 확인하는 함수
 */
function isTimeOverlap(time1, time2) {
    if (time1.day === '원격' || time2.day === '원격') {
        return false;
    }
    
    if (time1.day !== time2.day) {
        return false;
    }

    const start1 = convertTimeToMinutes(time1.start);
    const end1 = convertTimeToMinutes(time1.end);
    const start2 = convertTimeToMinutes(time2.start);
    const end2 = convertTimeToMinutes(time2.end);

    return !(end1 <= start2 || end2 <= start1);
}

/**
 * 시간을 분으로 변환하는 헬퍼 함수
 */
function convertTimeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

/**
 * 두 과목의 시간이 겹치는지 확인하는 함수
 */
function isSubjectsOverlap(subject1, subject2) {
    const times1 = typeof subject1.time_json === 'string' 
        ? JSON.parse(subject1.time_json) 
        : subject1.time_json;
    const times2 = typeof subject2.time_json === 'string' 
        ? JSON.parse(subject2.time_json) 
        : subject2.time_json;

    for (const time1 of times1) {
        for (const time2 of times2) {
            if (isTimeOverlap(time1, time2)) {
                return true;
            }
        }
    }
    return false;
}

/**
 * 새로운 과목을 추가할 수 있는지 확인하는 함수
 */
function canAddSubject(newSubject, selectedSubjects) {
    const timeJson = typeof newSubject.time_json === 'string' 
        ? JSON.parse(newSubject.time_json) 
        : newSubject.time_json;

    const isNewSubjectOnline = timeJson[0].day === '원격';
    
    if (isNewSubjectOnline) {
        const onlineCount = countOnlineCourses(selectedSubjects);
        if (onlineCount >= 2) {
            return false;
        }
        return true;
    }

    for (const subject of selectedSubjects) {
        if (isSubjectsOverlap(newSubject, subject)) {
            return false;
        }
    }
    return true;
}

module.exports = {
    isTimeOverlap,
    isSubjectsOverlap,
    canAddSubject,
    countOnlineCourses
};