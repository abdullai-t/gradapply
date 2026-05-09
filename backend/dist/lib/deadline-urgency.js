// @ts-nocheck
import { differenceInDays, startOfDay } from "date-fns";
/** Calendar-day delta from today to the deadline date (local), for badges and styling. */
export function deadlineDueMeta(deadline) {
    const d0 = startOfDay(deadline);
    const today = startOfDay(new Date());
    const daysUntil = differenceInDays(d0, today);
    const isOverdue = daysUntil < 0;
    return { daysUntil, isOverdue, d0, today };
}
/** Human label + tone for list UI (matches previous dashboard helper). */
export function deadlineUrgency(deadline) {
    const { daysUntil } = deadlineDueMeta(deadline);
    if (daysUntil < 0)
        return {
            label: `${Math.abs(daysUntil)}d overdue`,
            tone: "destructive",
        };
    if (daysUntil === 0)
        return { label: "Due today", tone: "destructive" };
    if (daysUntil <= 3)
        return { label: `Due in ${daysUntil}d`, tone: "destructive" };
    if (daysUntil <= 14)
        return { label: `Due in ${daysUntil}d`, tone: "amber" };
    return { label: `Due in ${daysUntil}d`, tone: "muted" };
}
