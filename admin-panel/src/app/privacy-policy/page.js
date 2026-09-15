export const metadata = {
  title: "Privacy Policy — Satyam Stars International School",
  description:
    "Privacy Policy for the Satyam Stars International School Teacher, Student, and Staff Attendance mobile apps.",
};

const SECTIONS = [
  {
    heading: "Overview",
    body: (
      <>
        <p>
          This Privacy Policy explains how Satyam Stars International School
          and Satyam Education Foundation ("the School", "we", "us") collect,
          use, and protect information through our mobile applications:
        </p>
        <ul className="list-disc pl-6 mt-2 space-y-1">
          <li><strong>Teacher App</strong> — for teaching staff</li>
          <li><strong>Student App</strong> — for enrolled students and their parents/guardians</li>
          <li><strong>Staff Attendance App</strong> — a kiosk app used at the school premises for staff attendance via face recognition</li>
        </ul>
        <p className="mt-2">
          These apps are provided solely for use by the School's own students,
          parents, and staff. They are not open for public registration —
          every account is created and issued by the School administration.
        </p>
      </>
    ),
  },
  {
    heading: "Information We Collect",
    body: (
      <>
        <p className="font-medium">Account &amp; identity information</p>
        <ul className="list-disc pl-6 mt-1 space-y-1">
          <li>Name, employee code or enrollment number, gender, date of birth</li>
          <li>Contact details: phone number(s), email address, home address</li>
          <li>Profile photograph</li>
          <li>Parent/guardian names and contact details (student accounts)</li>
          <li>Government identifiers collected during admission/employment (e.g. Aadhar, UDISE, PEN) where legally required for school records — these are managed by school administration and are not accessible within the Teacher, Student, or Attendance apps themselves</li>
        </ul>

        <p className="font-medium mt-4">Academic &amp; administrative data</p>
        <ul className="list-disc pl-6 mt-1 space-y-1">
          <li>Attendance records</li>
          <li>Exam marks, homework, syllabus progress</li>
          <li>Class, section, and timetable assignments</li>
          <li>Notices, tasks, leave requests, and queries raised through the apps</li>
        </ul>

        <p className="font-medium mt-4">Biometric data (Staff Attendance App only)</p>
        <p className="mt-1">
          The Staff Attendance kiosk app uses face recognition to record staff
          attendance. When a staff member enrolls, the app generates a
          mathematical representation of their face ("face embedding") used
          only to match their identity at punch-in/punch-out. It is not a
          photograph and is not used for any purpose beyond attendance
          verification at the school premises. This data is collected only
          from staff, with their knowledge, as part of the School's attendance
          system — never from students or the public.
        </p>

        <p className="font-medium mt-4">Device &amp; technical data</p>
        <p className="mt-1">
          Standard technical information needed to operate the apps securely,
          such as login session data. We do not use this data for advertising
          or tracking.
        </p>
      </>
    ),
  },
  {
    heading: "How We Use This Information",
    body: (
      <ul className="list-disc pl-6 space-y-1">
        <li>To operate core school-management features: attendance, marks, homework, timetables, notices, and communication between staff, students, and the school office</li>
        <li>To verify staff identity for attendance purposes (Staff Attendance App)</li>
        <li>To maintain accurate academic and administrative records</li>
        <li>To respond to queries and leave requests submitted through the apps</li>
      </ul>
    ),
  },
  {
    heading: "Data Sharing",
    body: (
      <>
        <p>
          We do not sell, rent, or share personal information with third
          parties for advertising or marketing purposes.
        </p>
        <p className="mt-2">
          Information is stored using Supabase, a third-party database and
          backend infrastructure provider, which processes data solely to
          provide hosting and database services to the School and does not
          use it for its own purposes. Information may also be disclosed if
          required by law or to protect the safety of students or staff.
        </p>
      </>
    ),
  },
  {
    heading: "Data Security",
    body: (
      <p>
        Data is transmitted using encrypted connections. Access to student
        and staff records within the apps is restricted to the relevant
        account holder and authorized school administration staff, based on
        their role.
      </p>
    ),
  },
  {
    heading: "Children's Privacy",
    body: (
      <p>
        The Student App is used by enrolled students of the School, including
        children under 18. Student accounts are created directly by the
        School as part of the admission process, using information already
        provided by parents/guardians to the School — the app does not
        collect any additional information directly from children beyond what
        the School already holds for enrollment and academic purposes.
        Parents/guardians may contact the school office (below) with any
        questions or requests regarding their child's data.
      </p>
    ),
  },
  {
    heading: "Data Retention",
    body: (
      <p>
        Academic and administrative records are retained for as long as the
        student is enrolled or the staff member is employed at the School,
        and thereafter as required by applicable education record-keeping
        requirements. Users may contact the school office to request
        correction of inaccurate information.
      </p>
    ),
  },
  {
    heading: "Account Provisioning",
    body: (
      <p>
        Accounts for all three apps are created and issued exclusively by
        School administration. There is no public sign-up. If you believe you
        have received app access in error, please contact the school office
        immediately.
      </p>
    ),
  },
  {
    heading: "Changes to This Policy",
    body: (
      <p>
        We may update this Privacy Policy from time to time. Changes will be
        posted on this page with an updated effective date.
      </p>
    ),
  },
  {
    heading: "Contact Us",
    body: (
      <address className="not-italic space-y-1">
        <p className="font-medium">Satyam Stars International School</p>
        <p>Swaminarayan Nagar – Bhidbhanjan Society, Pandesara, Surat, Gujarat 394221</p>
        <p>Phone: 8200069671</p>
        <p>Email: satyamstarsinternational@gmail.com</p>
      </address>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      <header className="bg-[#1e3a5f] text-white">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <h1 className="text-2xl sm:text-3xl font-bold">Privacy Policy</h1>
          <p className="mt-2 text-white/80">
            Satyam Stars International School — Teacher, Student &amp; Staff
            Attendance Apps
          </p>
          <p className="mt-1 text-white/60 text-sm">Effective date: 15 September 2026</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-10">
        {SECTIONS.map((s) => (
          <section key={s.heading}>
            <h2 className="text-lg font-semibold text-[#1e3a5f] mb-2">{s.heading}</h2>
            <div className="text-[15px] leading-relaxed text-slate-700">{s.body}</div>
          </section>
        ))}
      </main>

      <footer className="text-center text-xs text-slate-400 pb-10">
        © {new Date().getFullYear()} Satyam Stars International School / Satyam Education Foundation
      </footer>
    </div>
  );
}
