const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export type WeekdayName = (typeof WEEKDAYS)[number];

/** ISO date (YYYY-MM-DD) for the current calendar day in the given IANA timezone. */
export function getTodayIsoDateInTimezone(timezone: string, now = new Date()): string {
  return formatIsoDateInTimezone(now, timezone);
}

/** ISO date in the given timezone after adding whole days to an anchor ISO date. */
export function addDaysToIsoDateInTimezone(
  isoDate: string,
  days: number,
  timezone: string,
): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const anchor = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  anchor.setUTCDate(anchor.getUTCDate() + days);
  return formatIsoDateInTimezone(anchor, timezone);
}

export function formatIsoDateInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getWeekdayIndexInTimezone(isoDate: string, timezone: string): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
  })
    .format(new Date(`${isoDate}T12:00:00Z`))
    .toLowerCase();

  const index = WEEKDAYS.indexOf(weekday as WeekdayName);
  return index >= 0 ? index : 0;
}

/** Next occurrence of a weekday strictly after today when `forceNext` is true. */
export function getNextWeekdayIsoDateInTimezone(
  anchorIsoDate: string,
  weekdayName: string,
  timezone: string,
  forceNext = false,
): string | null {
  const target = WEEKDAYS.indexOf(weekdayName.toLowerCase() as WeekdayName);
  if (target < 0) return null;

  const current = getWeekdayIndexInTimezone(anchorIsoDate, timezone);
  let daysAhead = (target - current + 7) % 7;
  if (daysAhead === 0 && forceNext) {
    daysAhead = 7;
  }

  return addDaysToIsoDateInTimezone(anchorIsoDate, daysAhead, timezone);
}

export function resolveRelativeDatePhrase(
  phrase: string,
  timezone: string,
  anchorIsoDate?: string,
): string | null {
  const normalized = phrase.trim().toLowerCase();
  const today = anchorIsoDate ?? getTodayIsoDateInTimezone(timezone);

  if (normalized === "today") {
    return today;
  }

  if (normalized === "tomorrow") {
    return addDaysToIsoDateInTimezone(today, 1, timezone);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const nextWeekday = normalized.match(/^next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/);
  if (nextWeekday) {
    return getNextWeekdayIsoDateInTimezone(today, nextWeekday[1], timezone, true);
  }

  const weekdayOnly = normalized.match(
    /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/,
  );
  if (weekdayOnly) {
    return getNextWeekdayIsoDateInTimezone(today, weekdayOnly[1], timezone, false);
  }

  return null;
}

const MONTH_NAME_TO_INDEX: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

export function extractCalendarDatePhrase(question: string): string | null {
  const monthDay = question.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i,
  );
  if (monthDay) {
    return `${monthDay[1]} ${monthDay[2]}`;
  }

  return null;
}

export function resolveCalendarDatePhrase(
  phrase: string,
  timezone: string,
  anchorIsoDate?: string,
): string | null {
  const normalized = phrase.trim().toLowerCase().replace(/(\d+)(?:st|nd|rd|th)/, "$1");
  const match = normalized.match(/^([a-z]+)\s+(\d{1,2})$/);
  if (!match) return null;

  const month = MONTH_NAME_TO_INDEX[match[1]];
  const day = Number(match[2]);
  if (!month || day < 1 || day > 31) return null;

  const anchor = anchorIsoDate ?? getTodayIsoDateInTimezone(timezone);
  const [anchorYear] = anchor.split("-").map(Number);
  const monthString = String(month).padStart(2, "0");
  const dayString = String(day).padStart(2, "0");
  const candidate = `${anchorYear}-${monthString}-${dayString}`;

  const parsed = new Date(`${candidate}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;

  return candidate;
}

export function formatCalendarDatePhraseLabel(phrase: string): string {
  const match = phrase.trim().match(/^([A-Za-z]+)\s+(\d{1,2})/);
  if (!match) return phrase.trim();

  const month = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
  return `${month} ${Number(match[2])}`;
}
