export const metadata = {
  title: "Privacy Policy — Satyam Stars International School",
  description:
    "Privacy Policy for the Satyam Stars International School Teacher and Student apps and admin portal.",
};

const EFFECTIVE_DATE = "6 September 2026";
const CONTACT_EMAIL = "sectofficework@gmail.com";

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-slate-800">
      <div className="mb-8 flex items-center gap-4">
        <img
          src="/school-logo.jpg"
          alt="Satyam Stars International School logo"
          className="h-14 w-14 rounded object-cover"
        />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Privacy Policy</h1>
          <p className="text-sm text-slate-500">
            Satyam Stars International School, Surat, Gujarat
          </p>
        </div>
      </div>

      <p className="mb-6 text-sm text-slate-500">Effective date: {EFFECTIVE_DATE}</p>

      <p className="mb-6">
        This Privacy Policy describes how Satyam Stars International School
        ("the School", "we", "us") collects, uses, and protects information
        through the <strong>Satyam School – Teacher</strong> and{" "}
        <strong>Satyam School – Student</strong> mobile apps and the
        associated school administration web portal (together, "the Apps").
        The Apps are operated by the School solely for managing its own
        students and staff and are not available to the general public.
      </p>

      <h2 className="mt-8 mb-2 text-lg font-semibold text-slate-900">
        1. Who this policy covers
      </h2>
      <p className="mb-6">
        The Teacher app is used by school staff. The Student app is used by
        enrolled students and, where a parent/guardian manages the account on
        a student's behalf, by that parent or guardian. Because most students
        are minors, the School acts as the data controller and account
        creation is administered by the School, not self-registered by
        children directly from an app store listing.
      </p>

      <h2 className="mt-8 mb-2 text-lg font-semibold text-slate-900">
        2. Information we collect
      </h2>
      <ul className="mb-6 list-disc space-y-2 pl-6">
        <li>
          <strong>Identity and enrollment data:</strong> student/employee
          name, enrollment or employee ID, class/section or department, role,
          and contact details (phone number, email) already held in the
          School's records.
        </li>
        <li>
          <strong>Academic and attendance records:</strong> daily attendance
          status, leave requests, marks/grades, syllabus and homework
          progress, and related school records.
        </li>
        <li>
          <strong>Face attendance data (Teacher app only):</strong> the
          Teacher app's optional Face Punch feature captures a live selfie on
          the staff member's device and converts it, on-device, into a
          numeric face embedding (a set of ~192 numbers) using on-device
          processing — the photo itself is never uploaded or stored.
          Matching against the staff member's enrolled embedding also happens
          entirely on the device. Only the embedding is stored in our
          database, tied to that staff member's own record, to verify future
          punches.
        </li>
        <li>
          <strong>App usage and device data:</strong> basic technical data
          needed for the app to function, such as device type, app version,
          and crash/error logs.
        </li>
      </ul>
      <p className="mb-6">
        We do not collect data from anyone who is not a current student or
        staff member of the School, and we do not use the Apps to collect
        data for advertising or marketing purposes.
      </p>

      <h2 className="mt-8 mb-2 text-lg font-semibold text-slate-900">
        3. How we use this information
      </h2>
      <ul className="mb-6 list-disc space-y-2 pl-6">
        <li>Recording and reporting attendance, leave, and academic performance.</li>
        <li>Sharing syllabus, homework, circulars, and calendar information.</li>
        <li>Verifying staff identity for self-service attendance punches.</li>
        <li>School administration, record-keeping, and communication with students, staff, and parents/guardians.</li>
      </ul>

      <h2 className="mt-8 mb-2 text-lg font-semibold text-slate-900">
        4. Where data is stored
      </h2>
      <p className="mb-6">
        Data is stored using Supabase, a hosted database and backend
        provider, with access restricted to authenticated school staff and
        the relevant student/parent account. We do not sell any information
        collected through the Apps, and we do not share it with third
        parties except service providers (such as our hosting provider)
        strictly necessary to operate the Apps, or where required by law.
      </p>

      <h2 className="mt-8 mb-2 text-lg font-semibold text-slate-900">
        5. Data retention
      </h2>
      <p className="mb-6">
        Student and staff records are retained for as long as the individual
        is enrolled or employed at the School, and afterward for as long as
        required by the School's academic record-keeping obligations. Face
        embeddings are retained only while the staff member is employed and
        are deleted from our systems if the staff member leaves or requests
        removal.
      </p>

      <h2 className="mt-8 mb-2 text-lg font-semibold text-slate-900">
        6. Security
      </h2>
      <p className="mb-6">
        We restrict access to student and staff data to authenticated
        accounts belonging to the School, and take reasonable technical
        measures to protect it against unauthorized access, alteration, or
        loss.
      </p>

      <h2 className="mt-8 mb-2 text-lg font-semibold text-slate-900">
        7. Your rights
      </h2>
      <p className="mb-6">
        Students, parents/guardians, and staff may contact the School office
        to request access to, correction of, or deletion of their personal
        information held in the Apps, subject to the School's record-keeping
        obligations.
      </p>

      <h2 className="mt-8 mb-2 text-lg font-semibold text-slate-900">
        8. Changes to this policy
      </h2>
      <p className="mb-6">
        We may update this Privacy Policy from time to time. Material
        changes will be reflected by updating the effective date above.
      </p>

      <h2 className="mt-8 mb-2 text-lg font-semibold text-slate-900">
        9. Contact us
      </h2>
      <p className="mb-6">
        Questions about this Privacy Policy or your data can be sent to{" "}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="text-blue-600 underline"
        >
          {CONTACT_EMAIL}
        </a>
        .
      </p>
    </main>
  );
}
