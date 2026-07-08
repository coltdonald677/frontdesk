export function getTodayIsoDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00`);
}

export function addDaysToIsoDate(isoDate: string, days: number) {
  const date = parseIsoDate(isoDate);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDisplayDate(isoDate: string) {
  return parseIsoDate(isoDate).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTimeDisplay(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatTimeRange(startTime: string, endTime: string) {
  return `${formatTimeDisplay(startTime)} – ${formatTimeDisplay(endTime)}`;
}

export function isValidTimeRange(startTime: string, endTime: string) {
  return startTime < endTime;
}

export function isValidIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseIsoDate(value).getTime());
}

export function getWeekStart(isoDate: string) {
  const dayOfWeek = parseIsoDate(isoDate).getDay();
  return addDaysToIsoDate(isoDate, -dayOfWeek);
}

export function getWeekEnd(isoDate: string) {
  return addDaysToIsoDate(getWeekStart(isoDate), 6);
}

export function getWeekDates(isoDate: string) {
  const weekStart = getWeekStart(isoDate);
  return Array.from({ length: 7 }, (_, index) =>
    addDaysToIsoDate(weekStart, index),
  );
}

export function addWeeksToIsoDate(isoDate: string, weeks: number) {
  return addDaysToIsoDate(isoDate, weeks * 7);
}

export function formatWeekRange(startDate: string, endDate: string) {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  const sameYear = start.getFullYear() === end.getFullYear();

  const startFormatted = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const endFormatted = end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${startFormatted} – ${endFormatted}`;
}

export function formatShortDayHeader(isoDate: string) {
  return parseIsoDate(isoDate).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function isDateInWeek(isoDate: string, weekAnchor: string) {
  const weekStart = getWeekStart(weekAnchor);
  const weekEnd = getWeekEnd(weekAnchor);
  return isoDate >= weekStart && isoDate <= weekEnd;
}

function formatIsoFromDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getMonthStart(isoDate: string) {
  const date = parseIsoDate(isoDate);
  return formatIsoFromDate(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function getMonthEnd(isoDate: string) {
  const date = parseIsoDate(isoDate);
  return formatIsoFromDate(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

export function addMonthsToIsoDate(isoDate: string, months: number) {
  const date = parseIsoDate(isoDate);
  date.setMonth(date.getMonth() + months);
  return formatIsoFromDate(date);
}

export function getMonthCalendarDates(isoDate: string) {
  const monthStart = getMonthStart(isoDate);
  const monthEnd = getMonthEnd(isoDate);
  const gridStart = getWeekStart(monthStart);
  const dates: string[] = [];
  let current = gridStart;

  while (dates.length < 35 || current <= monthEnd || dates.length % 7 !== 0) {
    dates.push(current);
    current = addDaysToIsoDate(current, 1);
    if (dates.length >= 42) {
      break;
    }
  }

  while (dates.length % 7 !== 0) {
    dates.push(current);
    current = addDaysToIsoDate(current, 1);
  }

  return dates;
}

export function formatMonthYear(isoDate: string) {
  return parseIsoDate(isoDate).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function isDateInMonth(isoDate: string, monthAnchor: string) {
  const monthStart = getMonthStart(monthAnchor);
  const monthEnd = getMonthEnd(monthAnchor);
  return isoDate >= monthStart && isoDate <= monthEnd;
}

export function isCurrentMonth(monthAnchor: string) {
  return isDateInMonth(getTodayIsoDate(), monthAnchor);
}

export function formatMonthDayNumber(isoDate: string) {
  return String(parseIsoDate(isoDate).getDate());
}
