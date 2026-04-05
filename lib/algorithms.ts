/**
 * NexSchool AI - Core Enterprise Algorithms Let
 * 
 * Contains mathematically complex business logic handling constraints like 
 * timetabling clashes and financial compound interest.
 */

/**
 * Validates a pending schedule block against an array of existing scheduled blocks
 * using an Interval checking mechanism to prevent the exact same teacher from 
 * being present in two classes simultaneously.
 */
export interface ScheduleBlock {
  id: string;
  teacher_id: string;
  day_of_week: 1 | 2 | 3 | 4 | 5 | 6; // 1 = Monday
  start_minute_of_day: number; // e.g., 08:30 AM = (8 * 60) + 30 = 510
  end_minute_of_day: number;   // e.g., 09:15 AM = 555
}

export function detectTimetableClash(
  existingSchedule: ScheduleBlock[], 
  pendingBlock: ScheduleBlock
): { hasClash: boolean; conflictingBlockId?: string; reason?: string } {
  
  // 1. Filter schedule mapped to the same teacher and same day
  const relevantBlocks = existingSchedule.filter(
    block => block.teacher_id === pendingBlock.teacher_id && block.day_of_week === pendingBlock.day_of_week
  );

  if (relevantBlocks.length === 0) {
    return { hasClash: false };
  }

  // 2. Interval Tree overlap detection
  // Formula for overlap: Math.max(StartA, StartB) < Math.min(EndA, EndB)
  for (const block of relevantBlocks) {
    const overlapping = Math.max(block.start_minute_of_day, pendingBlock.start_minute_of_day) < Math.min(block.end_minute_of_day, pendingBlock.end_minute_of_day);
    
    if (overlapping) {
      return { 
        hasClash: true, 
        conflictingBlockId: block.id,
        reason: `Teacher is already assigned to a class between ${formatMinutes(block.start_minute_of_day)} and ${formatMinutes(block.end_minute_of_day)}.`
      };
    }
  }

  return { hasClash: false };
}

/** Helper to convert 510 -> 08:30 AM */
function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  return `${displayH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
}


/**
 * Calculates late fees using an educational compounding formula.
 * Late fee generates an initial penalty, plus a compounding daily fine 
 * if left unpaid for more than X days after the due date.
 */
export function calculateCompoundLateFees(
  baseAmount: number,
  dueDateStr: string,
  currentDateStr: string = new Date().toISOString()
): { totalAmount: number; latePenalty: number; daysLate: number } {
  const dueDate = new Date(dueDateStr);
  const currentDate = new Date(currentDateStr);
  
  // Normalize times to calculate pure days difference
  const diffTime = Math.max(currentDate.getTime() - dueDate.getTime(), 0);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

  if (diffDays <= 0) {
    return { totalAmount: baseAmount, latePenalty: 0, daysLate: 0 };
  }

  // Enterprise Logic: ₹100 flat late fine + ₹20 compound for every day late beyond a 3-day grace period
  let penalty = 100; // Flat initiation
  const gracePeriodDays = 3;
  const dailyFineRate = 20;

  if (diffDays > gracePeriodDays) {
    const compoundDays = diffDays - gracePeriodDays;
    penalty += (compoundDays * dailyFineRate);
  }

  // Cap late fee legally at 50% of the invoice gross base amount to avoid exorbitant penalties
  const maxPenalty = baseAmount * 0.5;
  if (penalty > maxPenalty) penalty = maxPenalty;

  return {
    totalAmount: baseAmount + penalty,
    latePenalty: penalty,
    daysLate: diffDays
  };
}
