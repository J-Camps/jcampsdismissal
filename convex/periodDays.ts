// Shared helpers for the Upper Camp two-schedule (Mon–Thu / Friday) period system.

export type DayType = "MonThu" | "Friday";

// Resolve which schedule a given "YYYY-MM-DD" date belongs to.
// Friday → "Friday"; every other day (incl. weekends, which have no camp) → "MonThu".
// Parsed at noon UTC so the weekday is stable regardless of server timezone.
export function dayTypeForDate(date: string): DayType {
  return new Date(`${date}T12:00:00Z`).getUTCDay() === 5 ? "Friday" : "MonThu";
}

// Normalize a possibly-missing stored dayType (legacy rows default to Mon–Thu).
export function normDayType(dayType?: string | null): DayType {
  return dayType === "Friday" ? "Friday" : "MonThu";
}
