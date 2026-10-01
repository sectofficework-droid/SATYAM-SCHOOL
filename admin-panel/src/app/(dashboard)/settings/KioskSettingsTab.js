"use client";

import { useEffect, useState } from "react";
import { Fingerprint, Clock, ShieldAlert, Save, CheckCircle2, AlertTriangle, KeyRound, CalendarClock, Trash2, Plus } from "lucide-react";
import {
  getKioskSettings, saveKioskSettings, setKioskAdminPin,
  listKioskSpecialDays, saveKioskSpecialDay, deleteKioskSpecialDay,
} from "@/lib/kioskSettingsService";

export default function KioskSettingsTab() {
  const [loading, setLoading] = useState(true);
  const [pinIsSet, setPinIsSet] = useState(false);

  const [startTime, setStartTime]   = useState("09:00");
  const [grace, setGrace]           = useState(10);
  const [cutoffEnabled, setCutoffEnabled] = useState(false);
  const [cutoffTime, setCutoffTime] = useState("11:00");
  const [shiftEndTime, setShiftEndTime] = useState("16:00");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState("");

  const [pin, setPin]               = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinSaving, setPinSaving]   = useState(false);
  const [pinSaved, setPinSaved]     = useState(false);
  const [pinError, setPinError]     = useState("");

  // Special-day overrides: management can set a one-off report time for a
  // specific future date (exam day, function, etc.) that applies only that
  // day and needs no manual revert afterwards.
  const [specialDays, setSpecialDays]           = useState([]);
  const [specialDaysLoading, setSpecialDaysLoading] = useState(true);
  const [sdDate, setSdDate]             = useState("");
  const [sdStartTime, setSdStartTime]   = useState("");
  const [sdGrace, setSdGrace]           = useState("");
  const [sdCutoffTime, setSdCutoffTime] = useState("");
  const [sdShiftEndTime, setSdShiftEndTime] = useState("");
  const [sdReason, setSdReason]         = useState("");
  const [sdSaving, setSdSaving]         = useState(false);
  const [sdError, setSdError]           = useState("");

  function load() {
    setLoading(true);
    getKioskSettings()
      .then(s => {
        setStartTime(s.expectedStartTime);
        setGrace(s.lateGraceMinutes);
        setCutoffEnabled(!!s.absentCutoffTime);
        if (s.absentCutoffTime) setCutoffTime(s.absentCutoffTime);
        setShiftEndTime(s.shiftEndTime);
        setPinIsSet(s.pinIsSet);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function loadSpecialDays() {
    setSpecialDaysLoading(true);
    listKioskSpecialDays()
      .then(setSpecialDays)
      .catch(() => {})
      .finally(() => setSpecialDaysLoading(false));
  }

  useEffect(() => { loadSpecialDays(); }, []);

  async function handleAddSpecialDay() {
    setSdError("");
    if (!sdDate) return setSdError("Pick a date.");
    if (!sdStartTime && !sdCutoffTime && !sdShiftEndTime && sdGrace === "") {
      return setSdError("Set at least one timing field to override.");
    }
    setSdSaving(true);
    try {
      await saveKioskSpecialDay({
        date: sdDate,
        expectedStartTime: sdStartTime,
        lateGraceMinutes: sdGrace,
        absentCutoffTime: sdCutoffTime,
        shiftEndTime: sdShiftEndTime,
        reason: sdReason,
      });
      setSdDate(""); setSdStartTime(""); setSdGrace(""); setSdCutoffTime(""); setSdShiftEndTime(""); setSdReason("");
      loadSpecialDays();
    } catch (e) {
      setSdError(e.message || "Failed to save.");
    } finally {
      setSdSaving(false);
    }
  }

  async function handleDeleteSpecialDay(date) {
    try {
      await deleteKioskSpecialDay(date);
      setSpecialDays(prev => prev.filter(d => d.date !== date));
    } catch (e) {
      setSdError(e.message || "Failed to delete.");
    }
  }

  async function handleSave() {
    setError(""); setSaving(true);
    try {
      await saveKioskSettings({
        expectedStartTime: startTime,
        lateGraceMinutes:  grace,
        absentCutoffTime:  cutoffEnabled ? cutoffTime : "",
        shiftEndTime:      shiftEndTime,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSetPin() {
    setPinError("");
    if (pin.length < 4) return setPinError("PIN must be at least 4 digits.");
    if (pin !== confirmPin) return setPinError("PINs don't match.");
    setPinSaving(true);
    try {
      await setKioskAdminPin(pin);
      setPin(""); setConfirmPin("");
      setPinIsSet(true);
      setPinSaved(true);
      setTimeout(() => setPinSaved(false), 2500);
    } catch (e) {
      setPinError(e.message || "Failed to set PIN.");
    } finally {
      setPinSaving(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center py-16 text-sm text-gray-400">Loading…</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-6xl">
      {/* Punch timing */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-school-navy/10 flex items-center justify-center">
            <Clock className="w-4.5 h-4.5 text-school-navy" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">Punch Timing</h3>
            <p className="text-xs text-gray-500">
              Used by the kiosk to judge a check-in as late or on time - applies to every staff member&apos;s first punch of the day.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Expected start time</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-school-navy" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Late grace (minutes)</label>
              <input type="number" min="0" value={grace} onChange={e => setGrace(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-school-navy" />
            </div>
          </div>
          <p className="text-xs text-gray-400 -mt-1">
            e.g. start time 9:00 AM + 10 min grace means anyone checking in after 9:10 AM is flagged late (the report still shows the true minutes late from 9:00, not from the grace cutoff).
          </p>

          <div className="border-t border-gray-100 pt-3.5">
            <div className="max-w-[160px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">Shift end time (auto check-out)</label>
              <input type="time" value={shiftEndTime} onChange={e => setShiftEndTime(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-school-navy" />
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              All open shifts are automatically checked out at this time every day. Staff who forget to check out from their app won&apos;t be blocked from punching in the next day.
            </p>
          </div>

          <div className="border-t border-gray-100 pt-3.5">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer mb-2">
              <input type="checkbox" checked={cutoffEnabled} onChange={e => setCutoffEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-school-navy focus:ring-school-navy/30" />
              Auto-mark Absent for staff who never punch in
            </label>
            {cutoffEnabled && (
              <div className="max-w-[160px]">
                <label className="block text-xs font-medium text-gray-500 mb-1">Cutoff time</label>
                <input type="time" value={cutoffTime} onChange={e => setCutoffTime(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-school-navy" />
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1.5">
              Any active staff member with no attendance recorded by this time gets marked Absent automatically. Staff already checked in or on approved leave are never touched.
            </p>
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-xs text-red-500"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />{error}</p>
          )}

          <div className="flex items-center gap-3 mt-1">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-school-navy text-white text-sm font-semibold hover:bg-school-navy-dark disabled:opacity-60 transition-colors">
              <Save className="w-4 h-4" />
              {saving ? "Saving…" : "Save"}
            </button>
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                <CheckCircle2 className="w-4 h-4" /> Saved
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Special-day overrides */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-school-navy/10 flex items-center justify-center">
            <CalendarClock className="w-4.5 h-4.5 text-school-navy" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">Special Occasion Timing</h3>
            <p className="text-xs text-gray-500">
              Set a one-off report time for a specific date (exam day, function, etc.). Only applies that day - the usual timing resumes automatically after.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3.5">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
            <input type="date" value={sdDate} onChange={e => setSdDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              className="w-full max-w-[200px] border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-school-navy" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Report by (start time)</label>
              <input type="time" value={sdStartTime} onChange={e => setSdStartTime(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-school-navy" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Late grace (minutes)</label>
              <input type="number" min="0" value={sdGrace} onChange={e => setSdGrace(e.target.value)}
                placeholder="default" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-school-navy" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Absent cutoff</label>
              <input type="time" value={sdCutoffTime} onChange={e => setSdCutoffTime(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-school-navy" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Shift end time</label>
              <input type="time" value={sdShiftEndTime} onChange={e => setSdShiftEndTime(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-school-navy" />
            </div>
          </div>
          <p className="text-xs text-gray-400 -mt-1">Leave any field blank to keep the normal default for that field on this date.</p>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Reason (optional)</label>
            <input type="text" value={sdReason} onChange={e => setSdReason(e.target.value)}
              placeholder="e.g. Annual Day rehearsal"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-school-navy" />
          </div>

          {sdError && (
            <p className="flex items-center gap-1.5 text-xs text-red-500"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />{sdError}</p>
          )}

          <div>
            <button onClick={handleAddSpecialDay} disabled={sdSaving}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-school-navy text-white text-sm font-semibold hover:bg-school-navy-dark disabled:opacity-60 transition-colors">
              <Plus className="w-4 h-4" />
              {sdSaving ? "Saving…" : "Add Special Day"}
            </button>
          </div>

          {!specialDaysLoading && specialDays.length > 0 && (
            <div className="border-t border-gray-100 pt-3.5 flex flex-col gap-2">
              {specialDays.map(d => (
                <div key={d.date} className="flex items-center justify-between gap-3 bg-gray-50 rounded-lg px-3 py-2">
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">{d.date}</span>
                    <span className="text-gray-500">
                      {d.expectedStartTime && ` · report by ${d.expectedStartTime}`}
                      {d.lateGraceMinutes !== "" && ` · ${d.lateGraceMinutes} min grace`}
                      {d.absentCutoffTime && ` · cutoff ${d.absentCutoffTime}`}
                      {d.shiftEndTime && ` · shift end ${d.shiftEndTime}`}
                    </span>
                    {d.reason && <p className="text-xs text-gray-400">{d.reason}</p>}
                  </div>
                  <button onClick={() => handleDeleteSpecialDay(d.date)} className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Admin PIN */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-school-navy/10 flex items-center justify-center">
            <Fingerprint className="w-4.5 h-4.5 text-school-navy" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">Kiosk Admin PIN</h3>
            <p className="text-xs text-gray-500">
              Required on the kiosk device to enroll or update a staff member&apos;s face. Set centrally here instead of on the device itself.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4 text-sm">
          {pinIsSet ? (
            <span className="flex items-center gap-1.5 text-green-600 font-medium"><CheckCircle2 className="w-4 h-4" />PIN is configured</span>
          ) : (
            <span className="flex items-center gap-1.5 text-amber-600 font-medium"><ShieldAlert className="w-4 h-4" />No PIN set yet - the kiosk&apos;s enroll screen is locked until you set one</span>
          )}
        </div>

        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{pinIsSet ? "New PIN" : "PIN"}</label>
              <input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-school-navy" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Confirm PIN</label>
              <input type="password" inputMode="numeric" maxLength={6} value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-school-navy" />
            </div>
          </div>

          {pinError && (
            <p className="flex items-center gap-1.5 text-xs text-red-500"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />{pinError}</p>
          )}

          <div className="flex items-center gap-3 mt-1">
            <button onClick={handleSetPin} disabled={pinSaving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-school-navy text-white text-sm font-semibold hover:bg-school-navy-dark disabled:opacity-60 transition-colors">
              <KeyRound className="w-4 h-4" />
              {pinSaving ? "Saving…" : pinIsSet ? "Reset PIN" : "Set PIN"}
            </button>
            {pinSaved && (
              <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                <CheckCircle2 className="w-4 h-4" /> Saved
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
