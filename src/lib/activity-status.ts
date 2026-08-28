// Ported from the web repo's src/lib/activityStatus.ts (classifyActivity / groupActivitiesByStatus)
// — same exhaustive classification rule, so "Today"/"Overdue"/"Upcoming"/"Completed" here never
// disagree with what the web app calls the same activity.
import type { Activity } from '@/types';

export type ActivityBucket = 'DUE_TODAY' | 'UPCOMING' | 'OVERDUE' | 'COMPLETED';

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function classifyActivity(activity: Activity, today: Date): ActivityBucket {
  if ((activity.percentComplete ?? 0) >= 100 || activity.state === 'VERIFIED' || activity.state === 'CLOSED') {
    return 'COMPLETED';
  }
  if (!activity.plannedEnd) return 'UPCOMING';
  const due = startOfDay(new Date(activity.plannedEnd));
  if (due.getTime() === today.getTime()) return 'DUE_TODAY';
  if (due.getTime() < today.getTime()) return 'OVERDUE';
  return 'UPCOMING';
}

function plannedEndTime(activity: Activity): number {
  return activity.plannedEnd ? new Date(activity.plannedEnd).getTime() : Infinity;
}

export function groupActivitiesByStatus(activities: Activity[], today: Date = startOfDay(new Date())): Record<ActivityBucket, Activity[]> {
  const groups: Record<ActivityBucket, Activity[]> = { DUE_TODAY: [], UPCOMING: [], OVERDUE: [], COMPLETED: [] };
  for (const activity of activities) {
    groups[classifyActivity(activity, today)].push(activity);
  }
  // Soonest due date first within Upcoming/Overdue, so the next thing coming up leads the list
  // instead of whatever order the API happened to return (previously just insertion order).
  groups.UPCOMING.sort((a, b) => plannedEndTime(a) - plannedEndTime(b));
  groups.OVERDUE.sort((a, b) => plannedEndTime(a) - plannedEndTime(b));
  // Completed: most recently finished first.
  groups.COMPLETED.sort((a, b) => plannedEndTime(b) - plannedEndTime(a));
  return groups;
}
