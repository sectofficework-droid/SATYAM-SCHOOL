"use client";

import { useEffect, useState } from "react";
import { Save, CheckCircle2, GraduationCap, User } from "lucide-react";
import { getSchoolRules, saveSchoolRules } from "@/lib/settingsService";

function RulesEditorCard({ audience, label, icon: Icon, initialContent }) {
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await saveSchoolRules(audience, content);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-xl bg-school-navy/10 flex items-center justify-center">
          <Icon className="w-4.5 h-4.5 text-school-navy" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-800">{label} Rules & Regulations</h3>
          <p className="text-xs text-gray-500">
            Shown read-only to {label.toLowerCase()}s in the mobile app, under Rules & Regulations.
          </p>
        </div>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={14}
        placeholder={`Type the ${label.toLowerCase()} rules and regulations here — this is exactly what ${label.toLowerCase()}s will see in the app.`}
        className="w-full mt-4 px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy resize-y leading-relaxed"
      />

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-school-navy text-white text-sm font-semibold hover:bg-school-navy-dark disabled:opacity-60 transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving…" : "Save"}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
            <CheckCircle2 className="w-4 h-4" /> Saved — visible in the app now
          </span>
        )}
      </div>
    </div>
  );
}

export default function RulesRegulationsTab() {
  const [rules, setRules]     = useState(null); // { teacher, student }
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    getSchoolRules()
      .then(setRules)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-sm text-gray-400">Loading…</div>
  );

  if (error) return (
    <div className="flex items-center justify-center py-24 text-sm text-red-500">{error}</div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-6xl">
      <RulesEditorCard audience="student" label="Student" icon={GraduationCap} initialContent={rules.student} />
      <RulesEditorCard audience="teacher" label="Teacher" icon={User} initialContent={rules.teacher} />
    </div>
  );
}
