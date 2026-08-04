"use client";

import { useEffect, useState } from "react";
import { Smartphone, UploadCloud, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { getAppVersionHistory, getLatestAppVersion, publishAppVersion } from "@/lib/appUpdateService";
import { uploadFileToS3Presigned, slugify } from "@/lib/s3Upload";

// Same bucket the mobile app already reads photos/documents from directly
// (no auth) - see mobile-app/lib/common/widgets/s3_image.dart's _s3Base.
const S3_BASE = "https://satyam-stars-international-school.s3.ap-south-1.amazonaws.com";

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AppUpdateTab() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const [file, setFile]               = useState(null);
  const [versionName, setVersionName] = useState("");
  const [versionCode, setVersionCode] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [forceUpdate, setForceUpdate] = useState(false);

  const [publishing, setPublishing] = useState(false);
  const [error, setError]           = useState("");
  const [published, setPublished]   = useState(false);

  const latest = history[0] || null;

  function load() {
    setLoading(true);
    getAppVersionHistory()
      .then(rows => {
        setHistory(rows);
        setVersionCode(String((rows[0]?.version_code || 0) + 1));
      })
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handlePublish() {
    setError("");
    if (!file) return setError("Choose the .apk file to publish first.");
    if (!versionName.trim()) return setError("Enter a version name, e.g. 1.4.0");
    const code = parseInt(versionCode, 10);
    if (!Number.isInteger(code) || code <= 0) return setError("Version code must be a whole number.");
    if (latest && code <= latest.version_code) return setError(`Version code must be higher than the current one (${latest.version_code}).`);

    setPublishing(true);
    try {
      const key = `app/v${code}-${slugify(versionName)}.apk`;
      await uploadFileToS3Presigned(file, key);
      await publishAppVersion({ versionName: versionName.trim(), versionCode: code, apkKey: key, releaseNotes, forceUpdate });
      setPublished(true);
      setFile(null);
      setReleaseNotes("");
      setForceUpdate(false);
      load();
      setTimeout(() => setPublished(false), 3000);
    } catch (e) {
      setError(e.message || "Failed to publish this version.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-6xl">
      {/* Publish form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-school-navy/10 flex items-center justify-center">
            <Smartphone className="w-4.5 h-4.5 text-school-navy" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">Publish App Update</h3>
            <p className="text-xs text-gray-500">
              Teachers and students get an &quot;update available&quot; prompt next time they open the app.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3.5">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">APK file</label>
            <input type="file" accept=".apk"
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-school-navy file:text-white file:text-sm file:font-medium file:cursor-pointer cursor-pointer" />
            {file && <p className="text-xs text-gray-400 mt-1">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Version name</label>
              <input type="text" value={versionName} onChange={e => setVersionName(e.target.value)} placeholder="e.g. 1.4.0"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-school-navy" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Version code</label>
              <input type="number" value={versionCode} onChange={e => setVersionCode(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-school-navy" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Release notes (optional)</label>
            <textarea value={releaseNotes} onChange={e => setReleaseNotes(e.target.value)} rows={3}
              placeholder="What changed in this update?"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-school-navy resize-none" />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={forceUpdate} onChange={e => setForceUpdate(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-school-navy focus:ring-school-navy/30" />
            Force update — users can&apos;t dismiss the prompt without updating
          </label>

          {error && (
            <p className="flex items-center gap-1.5 text-xs text-red-500"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />{error}</p>
          )}

          <div className="flex items-center gap-3 mt-1">
            <button onClick={handlePublish} disabled={publishing}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-school-navy text-white text-sm font-semibold hover:bg-school-navy-dark disabled:opacity-60 transition-colors">
              <UploadCloud className="w-4 h-4" />
              {publishing ? "Publishing…" : "Publish Update"}
            </button>
            {published && (
              <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                <CheckCircle2 className="w-4 h-4" /> Published
              </span>
            )}
          </div>
        </div>
      </div>

      {/* History */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-semibold text-gray-800 mb-4">Published Versions</h3>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-gray-400">Loading…</div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Clock className="w-8 h-8 text-gray-200" />
            <p className="text-sm text-gray-400">No versions published yet</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 max-h-[420px] overflow-y-auto">
            {history.map((v, i) => (
              <div key={v.id} className={`rounded-xl border p-3.5 ${i === 0 ? "border-school-navy/30 bg-school-navy/5" : "border-gray-100"}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800 text-sm">v{v.version_name}</span>
                    <span className="text-[11px] text-gray-400">code {v.version_code}</span>
                    {i === 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-school-navy text-white">LATEST</span>}
                    {v.force_update && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">FORCED</span>}
                  </div>
                  <span className="text-xs text-gray-400">{fmtDate(v.created_at)}</span>
                </div>
                {v.release_notes && <p className="text-xs text-gray-500 mt-1.5">{v.release_notes}</p>}
                <a href={`${S3_BASE}/${v.apk_key}`} target="_blank" rel="noreferrer"
                  className="inline-block text-xs text-school-navy font-medium mt-1.5 hover:underline">
                  Download APK
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
