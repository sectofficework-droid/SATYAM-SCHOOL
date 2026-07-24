// India's fixed-date national holidays - the same Gregorian date every year,
// so these are safe to hardcode. Lunar-calendar festivals (Diwali, Holi,
// Eid, etc.) shift every year and are deliberately NOT included here -
// asserting a wrong date would be worse than not showing one. Those get
// added per-year from the admin panel's Calendar page instead, alongside
// any other school-declared holiday/event/exam date.
class NationalHoliday {
  final int month;
  final int day;
  final String title;
  const NationalHoliday(this.month, this.day, this.title);
}

const List<NationalHoliday> fixedNationalHolidays = [
  NationalHoliday(1, 1, "New Year's Day"),
  NationalHoliday(1, 26, 'Republic Day'),
  NationalHoliday(5, 1, 'Labour Day'),
  NationalHoliday(8, 15, 'Independence Day'),
  NationalHoliday(10, 2, 'Gandhi Jayanti'),
  NationalHoliday(12, 25, 'Christmas'),
];

List<NationalHoliday> nationalHolidaysInMonth(int month) =>
    fixedNationalHolidays.where((h) => h.month == month).toList();
