/**
 * Algorithms Library for NexSchool ERP
 */

interface ClassReq {
    id: string;
    className: string;
    subject: string;
    teacherId: string;
    hoursNeeded: number;
}
  
interface TimeSlot {
    day: number; // 1 to 5 (Mon-Fri)
    period: number; // 1 to 8
    className: string;
    subject: string;
    teacherId: string;
}

/**
 * generateTimetable
 * Generates an automated, non-colliding timetable using a greedy back-tracking approach.
 * Ensures that no teacher is assigned to two different classes in the same period.
 * 
 * @param {ClassReq[]} requirements - The classes that need to be scheduled.
 * @param {number} days - Number of working days (e.g., 5 for Mon-Fri)
 * @param {number} periodsPerDay - Number of periods per day (e.g., 8)
 * @returns {TimeSlot[]} An array of generated timeslots with no teacher overlaps.
 */
export function generateTimetable(requirements: ClassReq[], days: number = 5, periodsPerDay: number = 8): TimeSlot[] {
    const timetable: TimeSlot[] = [];
    const teacherSchedule = new Map<string, Set<string>>(); // teacherId -> Set of "day-period"

    // Helper to check collision
    const isTeacherAvailable = (tId: string, day: number, period: number) => {
        const key = `${day}-${period}`;
        if (!teacherSchedule.has(tId)) {
            return true;
        }
        return !teacherSchedule.get(tId)!.has(key);
    };

    // Helper to mark assigned
    const markTeacherAssigned = (tId: string, day: number, period: number) => {
        const key = `${day}-${period}`;
        if (!teacherSchedule.has(tId)) {
            teacherSchedule.set(tId, new Set());
        }
        teacherSchedule.get(tId)!.add(key);
    };

    // Make a mutable copy of requirements
    let pendingReqs = requirements.map(r => ({ ...r }));

    // Greedy assignment
    for (let day = 1; day <= days; day++) {
        for (let period = 1; period <= periodsPerDay; period++) {
            
            // We need to schedule all classes in this period.
            // Wait, standard scheduling logic: For a specific class section (e.g. 10A), we need exactly one subject per period.
            // This simple algorithm iterates over the requirements and fills available spots
            
            const reqsToProcess = [...pendingReqs];
            const classAssigned = new Set<string>(); // Keep track so a class gets only 1 subject per period

            for (let i = 0; i < reqsToProcess.length; i++) {
                const req = reqsToProcess[i];
                if (req.hoursNeeded > 0) {
                    if (!classAssigned.has(req.className) && isTeacherAvailable(req.teacherId, day, period)) {
                        timetable.push({
                            day,
                            period,
                            className: req.className,
                            subject: req.subject,
                            teacherId: req.teacherId
                        });
                        markTeacherAssigned(req.teacherId, day, period);
                        classAssigned.add(req.className);
                        req.hoursNeeded--;
                    }
                }
            }

            // Clean up completed requirements
            pendingReqs = pendingReqs.filter(r => r.hoursNeeded > 0);
        }
    }

    return timetable;
}

export function calculateCompoundLateFees(baseAmount: number, dueDateStr: string, currentDateStr?: string) {
    const due = new Date(dueDateStr);
    const curr = currentDateStr ? new Date(currentDateStr) : new Date();
    
    // Set hours to 0 to avoid timezone edge cases on diffing
    due.setHours(0,0,0,0);
    curr.setHours(0,0,0,0);

    const diffTime = curr.getTime() - due.getTime();
    const daysLate = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysLate <= 0) {
        return { daysLate: 0, latePenalty: 0, totalAmount: baseAmount };
    }

    let penalty = 0;
    if (daysLate <= 3) {
        penalty = 100;
    } else {
        penalty = 100 + ((daysLate - 3) * 20);
    }

    const cap = baseAmount * 0.5;
    if (penalty > cap) penalty = cap;

    return { daysLate, latePenalty: penalty, totalAmount: baseAmount + penalty };
}

export interface ScheduleBlock {
  id: string;
  teacher_id: string;
  day_of_week: number;
  start_minute_of_day: number;
  end_minute_of_day: number;
}

export function detectTimetableClash(existing: ScheduleBlock[], incoming: ScheduleBlock) {
    for (const b of existing) {
        if (b.teacher_id === incoming.teacher_id && b.day_of_week === incoming.day_of_week) {
            if (incoming.start_minute_of_day < b.end_minute_of_day && incoming.end_minute_of_day > b.start_minute_of_day) {
                return { hasClash: true, conflictingBlockId: b.id };
            }
        }
    }
    return { hasClash: false };
}
