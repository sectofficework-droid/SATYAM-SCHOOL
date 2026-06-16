// ── Year Planning: categories, academic-year calendar shape, seed events ──

export const YEAR_PLAN_CATEGORIES = [
  { key:"govt",        label:"Govt Holiday", color:"#ef4444", light:"bg-red-50",    text:"text-red-700",    chip:"bg-red-100",    icon:"Flag"       },
  { key:"function",    label:"Function",     color:"#8b5cf6", light:"bg-violet-50", text:"text-violet-700", chip:"bg-violet-100", icon:"PartyPopper"},
  { key:"celebration", label:"Celebration",  color:"#f59e0b", light:"bg-amber-50",  text:"text-amber-700",  chip:"bg-amber-100",  icon:"Sparkles"   },
  { key:"ptm",         label:"PTM",          color:"#3b82f6", light:"bg-blue-50",   text:"text-blue-700",   chip:"bg-blue-100",   icon:"Users"      },
  { key:"exam",        label:"Exam",         color:"#e11d48", light:"bg-rose-50",   text:"text-rose-700",   chip:"bg-rose-100",   icon:"FileText"   },
  { key:"holiday",     label:"Holiday",      color:"#0d9488", light:"bg-teal-50",   text:"text-teal-700",   chip:"bg-teal-100",   icon:"Palmtree"   },
  { key:"sunday",      label:"Sunday",       color:"#f97316", light:"bg-orange-50", text:"text-orange-700", chip:"bg-orange-100", icon:"Moon"       },
];

export const YEAR_PLAN_ICON_CHOICES = [
  "Flag","PartyPopper","Sparkles","Users","FileText","Palmtree","Moon","Sun","Gift","Star",
  "CalendarDays","CalendarHeart","BookOpenCheck","PenSquare","GraduationCap","School","Trophy",
  "Music","Camera","Cake","Heart",
];

export const ACADEMIC_MONTHS = [
  { label:"June",      year:2026, month:6,  days:30 },
  { label:"July",       year:2026, month:7,  days:31 },
  { label:"August",     year:2026, month:8,  days:31 },
  { label:"September",  year:2026, month:9,  days:30 },
  { label:"October",    year:2026, month:10, days:31 },
  { label:"November",   year:2026, month:11, days:30 },
  { label:"December",   year:2026, month:12, days:31 },
  { label:"January",    year:2027, month:1,  days:31 },
  { label:"February",   year:2027, month:2,  days:28 },
  { label:"March",      year:2027, month:3,  days:31 },
  { label:"April",      year:2027, month:4,  days:30 },
  { label:"May",        year:2027, month:5,  days:31 },
];

function pad(n) { return String(n).padStart(2, "0"); }

function dateRange(from, to) {
  const out = [];
  const d = new Date(from);
  const end = new Date(to);
  while (d <= end) {
    out.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

// Seeded with the actual 2026-27 festival/holiday calendar (verified against
// published Indian almanac sources). School-decided events (PTM, exams,
// functions, vacation blocks) are placed around them at sensible gaps —
// adjust freely from the UI to match the school's final schedule.
const RANGE_EVENTS = [
  { from:"2026-09-21", to:"2026-09-28", category:"exam",    label:"Examination" },
  { from:"2026-12-01", to:"2026-12-10", category:"exam",    label:"Examination" },
  { from:"2027-02-05", to:"2027-02-13", category:"exam",    label:"Examination" },
  { from:"2027-03-10", to:"2027-03-19", category:"exam",    label:"Final Examination" },
  { from:"2026-11-03", to:"2026-11-13", category:"holiday", label:"Diwali Vacation" },
  { from:"2027-04-26", to:"2027-05-31", category:"holiday", label:"Summer Vacation" },
];

const SINGLE_EVENTS = [
  { date:"2026-06-13", category:"function",    label:"School Reopens" },
  { date:"2026-06-21", category:"celebration", label:"Yoga Day" },
  { date:"2026-06-29", category:"function",    label:"Tree Plantation" },

  { date:"2026-07-16", category:"function",    label:"Rath Yatra" },
  { date:"2026-07-26", category:"govt",        label:"Kargil Vijay Diwas" },
  { date:"2026-07-29", category:"celebration", label:"Guru Purnima" },

  { date:"2026-08-01", category:"ptm",         label:"PTM" },
  { date:"2026-08-02", category:"celebration", label:"Friendship Day Celebration" },
  { date:"2026-08-08", category:"function",    label:"Annual Function" },
  { date:"2026-08-15", category:"govt",        label:"Independence Day" },
  { date:"2026-08-19", category:"celebration", label:"World Photography Day" },
  { date:"2026-08-24", category:"celebration", label:"Rakhi Making Competition" },
  { date:"2026-08-26", category:"govt",        label:"Eid-e-Milad" },
  { date:"2026-08-28", category:"govt",        label:"Raksha Bandhan" },
  { date:"2026-08-29", category:"function",    label:"National Sports Day" },

  { date:"2026-09-02", category:"celebration", label:"Paper Craft Competition" },
  { date:"2026-09-04", category:"govt",        label:"Janmashtami" },
  { date:"2026-09-05", category:"celebration", label:"Teachers Day" },
  { date:"2026-09-14", category:"celebration", label:"Hindi Diwas" },
  { date:"2026-09-14", category:"govt",        label:"Ganesh Chaturthi" },

  { date:"2026-10-01", category:"function",    label:"Grand Parents Day" },
  { date:"2026-10-02", category:"govt",        label:"Gandhi Jayanti" },
  { date:"2026-10-10", category:"function",    label:"Navratri Starts" },
  { date:"2026-10-11", category:"ptm",         label:"PTM" },
  { date:"2026-10-15", category:"function",    label:"Parents Garba" },
  { date:"2026-10-19", category:"govt",        label:"Dussehra" },
  { date:"2026-10-24", category:"function",    label:"School Picnic" },

  { date:"2026-11-06", category:"govt",        label:"Dhanteras" },
  { date:"2026-11-08", category:"govt",        label:"Diwali" },
  { date:"2026-11-10", category:"celebration", label:"Bhai Dooj" },
  { date:"2026-11-14", category:"celebration", label:"Children's Day" },
  { date:"2026-11-22", category:"ptm",         label:"PTM" },
  { date:"2026-11-24", category:"govt",        label:"Guru Nanak Jayanti" },

  { date:"2026-12-06", category:"ptm",         label:"PTM" },
  { date:"2026-12-25", category:"govt",        label:"Christmas Day" },

  { date:"2027-01-01", category:"govt",        label:"Happy New Year" },
  { date:"2027-01-01", category:"function",    label:"New Admission Starts 2027-28" },
  { date:"2027-01-06", category:"ptm",         label:"PTM" },
  { date:"2027-01-08", category:"function",    label:"Sports Week Starts" },
  { date:"2027-01-12", category:"celebration", label:"Swami Vivekananda Jayanti" },
  { date:"2027-01-14", category:"govt",        label:"Makar Sankranti" },
  { date:"2027-01-26", category:"govt",        label:"Republic Day" },

  { date:"2027-02-04", category:"ptm",         label:"PTM" },
  { date:"2027-02-10", category:"celebration", label:"Handwriting Competition" },
  { date:"2027-02-11", category:"celebration", label:"Saraswati Pooja (Vasant Panchami)" },
  { date:"2027-02-19", category:"celebration", label:"Shivaji Jayanti" },
  { date:"2027-02-25", category:"ptm",         label:"Teachers Training + PTM" },
  { date:"2027-02-28", category:"function",    label:"Science Fair" },

  { date:"2027-03-06", category:"govt",        label:"Maha Shivratri" },
  { date:"2027-03-09", category:"govt",        label:"Ramzan-Id" },
  { date:"2027-03-11", category:"celebration", label:"Mom's Magic Dish" },
  { date:"2027-03-22", category:"govt",        label:"Holi" },
  { date:"2027-03-24", category:"celebration", label:"Fancy Dance Competition" },
  { date:"2027-03-26", category:"govt",        label:"Good Friday" },

  { date:"2027-04-14", category:"govt",        label:"Ambedkar Jayanti" },
  { date:"2027-04-15", category:"govt",        label:"Ram Navami" },
  { date:"2027-04-19", category:"govt",        label:"Mahavir Jayanti" },
  { date:"2027-04-22", category:"function",    label:"Earth Day" },

  { date:"2027-05-08", category:"govt",        label:"Parshuram Jayanti" },
  { date:"2027-05-09", category:"celebration", label:"Mother's Day" },
  { date:"2027-05-17", category:"govt",        label:"Bakrid" },
];

let _eid = 0;
function mkEvent(date, category, label, icon) {
  _eid++;
  return { id:`ev${_eid}`, date, category, label, icon: icon || null };
}

export const SEED_YEAR_PLAN_EVENTS = [
  ...RANGE_EVENTS.flatMap(r => dateRange(r.from, r.to).map(d => mkEvent(d, r.category, r.label))),
  ...SINGLE_EVENTS.map(e => mkEvent(e.date, e.category, e.label, e.icon)),
];
