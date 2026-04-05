/**
 * NexSchool AI - Critical Business Logic Unit Tests
 * Covers: calculateCompoundLateFees + detectTimetableClash
 *
 * Run: npx jest lib/algorithms.test.ts
 */
import { calculateCompoundLateFees, detectTimetableClash, ScheduleBlock } from './algorithms';

// ─────────────────────────────────────────────────────────────────────
// SECTION 1: FEE CALCULATION TESTS (CRITICAL — touches real money)
// ─────────────────────────────────────────────────────────────────────

describe('calculateCompoundLateFees', () => {
  const BASE = 10000; // ₹10,000 base invoice

  it('should return base amount with no penalty when paid on the due date', () => {
    const dueDate = '2026-04-01';
    const currentDate = '2026-04-01';
    const result = calculateCompoundLateFees(BASE, dueDate, currentDate);
    expect(result.latePenalty).toBe(0);
    expect(result.totalAmount).toBe(BASE);
    expect(result.daysLate).toBe(0);
  });

  it('should return base amount with no penalty within grace period (3 days)', () => {
    const result = calculateCompoundLateFees(BASE, '2026-04-01', '2026-04-03');
    // 2 days late — within 3-day grace → only flat ₹100
    expect(result.latePenalty).toBe(100);
    expect(result.totalAmount).toBe(10100);
  });

  it('should apply compound fine correctly after grace period', () => {
    // 5 days late = ₹100 flat + (2 extra days × ₹20) = ₹140 penalty
    const result = calculateCompoundLateFees(BASE, '2026-04-01', '2026-04-06');
    expect(result.daysLate).toBe(5);
    expect(result.latePenalty).toBe(140);
    expect(result.totalAmount).toBe(10140);
  });

  it('should cap penalty at 50% of base amount (legal cap protection)', () => {
    // Very high number of days late — should cap at 50% of 10000 = ₹5000
    const result = calculateCompoundLateFees(BASE, '2026-01-01', '2026-04-01');
    expect(result.latePenalty).toBeLessThanOrEqual(BASE * 0.5);
    expect(result.totalAmount).toBeLessThanOrEqual(BASE * 1.5);
  });

  it('should handle zero-value invoice correctly without breaking', () => {
    const result = calculateCompoundLateFees(0, '2026-04-01', '2026-04-10');
    expect(result.totalAmount).toBe(0); // 50% cap of 0 = 0, so no penalty
    expect(result.latePenalty).toBe(0);
  });

  it('should return no penalty for a future due date (payment paid early)', () => {
    const result = calculateCompoundLateFees(BASE, '2026-12-31', '2026-04-01');
    expect(result.latePenalty).toBe(0);
    expect(result.daysLate).toBe(0);
  });
});


// ─────────────────────────────────────────────────────────────────────
// SECTION 2: TIMETABLE CLASH DETECTION TESTS (CRITICAL — prevents teacher conflicts)
// ─────────────────────────────────────────────────────────────────────

describe('detectTimetableClash', () => {
  const baseBlock: ScheduleBlock = {
    id: 'block-1',
    teacher_id: 'teacher-a',
    day_of_week: 1,
    start_minute_of_day: 510,  // 08:30 AM
    end_minute_of_day: 570,    // 09:30 AM
  };

  it('should not detect a clash for an empty schedule', () => {
    const pending: ScheduleBlock = { ...baseBlock, id: 'block-x' };
    const result = detectTimetableClash([], pending);
    expect(result.hasClash).toBe(false);
  });

  it('should detect a direct time overlap on the same day', () => {
    const overlap: ScheduleBlock = { ...baseBlock, id: 'block-y', start_minute_of_day: 540, end_minute_of_day: 600 };
    const result = detectTimetableClash([baseBlock], overlap);
    expect(result.hasClash).toBe(true);
    expect(result.conflictingBlockId).toBe('block-1');
  });

  it('should NOT detect a clash if the same teacher teaches on a different day', () => {
    const differentDay: ScheduleBlock = { ...baseBlock, id: 'block-y', day_of_week: 2 }; // Tuesday
    const result = detectTimetableClash([baseBlock], differentDay);
    expect(result.hasClash).toBe(false);
  });

  it('should NOT detect a clash for a different teacher on the same day and time', () => {
    const otherTeacher: ScheduleBlock = { ...baseBlock, id: 'block-y', teacher_id: 'teacher-b' };
    const result = detectTimetableClash([baseBlock], otherTeacher);
    expect(result.hasClash).toBe(false);
  });

  it('should not clash for adjacent (back-to-back) non-overlapping periods', () => {
    // Ends at 570, next starts at 570 — should NOT be a clash
    const adjacent: ScheduleBlock = { ...baseBlock, id: 'block-y', start_minute_of_day: 570, end_minute_of_day: 630 };
    const result = detectTimetableClash([baseBlock], adjacent);
    expect(result.hasClash).toBe(false);
  });
});
