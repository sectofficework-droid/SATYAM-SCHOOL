// Working-day / holiday rule for the admin panel's Attendance module - JS
// port of mobile-app/lib/core/utils/working_day.dart's isWorkingDay(), kept
// in sync by hand since the two apps read the same school_calendar_events
// table and must never disagree about whether a date is working for a
// given class. See that file for the full rationale.
//
// Sunday defaults to non-working, for every class. A 'working_day' event on
// a specific date overrides that (and any 'holiday'/'govt' event on the
// same date) - scoped to `classes` (from calendarService's `classes` field)
// when set, or every class when null/empty.

function appliesToClass(event, className) {
  const scope = event.classes;
  if (!scope || scope.length === 0) return true;
  if (!className) return true; // no class context to check against - don't filter
  return scope.includes(className);
}

function eventsOn(date, calendarEvents) {
  return calendarEvents.filter(e => e.date === date);
}

export function isWorkingDay(dateStr, calendarEvents, className) {
  const onDate = eventsOn(dateStr, calendarEvents).filter(e => appliesToClass(e, className));
  if (onDate.some(e => e.category === "working_day")) return true;
  const weekday = new Date(dateStr + "T00:00:00").getDay(); // 0 = Sunday
  if (weekday === 0) return false;
  if (onDate.some(e => e.category === "holiday" || e.category === "govt")) return false;
  return true;
}

export function nonWorkingReason(dateStr, calendarEvents, className) {
  const holidayEvents = eventsOn(dateStr, calendarEvents)
    .filter(e => appliesToClass(e, className))
    .filter(e => e.category === "holiday" || e.category === "govt");
  if (holidayEvents.length > 0) return holidayEvents[0].label || "Holiday";
  return "Sunday";
}
