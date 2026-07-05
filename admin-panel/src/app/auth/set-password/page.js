"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { Eye, EyeOff, Lock, ShieldCheck, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabase";
import useStore from "@/lib/store";

export default function SetPasswordPage() {
  const router = useRouter();
  const setAuthUser = useStore((s) => s.setAuthUser);

  const [ready, setReady] = useState(false);  // session confirmed
  const [sessionError, setSessionError] = useState("");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showP, setShowP] = useState(false);
  const [showC, setShowC] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Verify we have a valid recovery session before showing the form
  useEffect(() => {
    let settled = false;

    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) { settled = true; setReady(true); return; }

      // Listen for PASSWORD_RECOVERY or SIGNED_IN (hash-based recovery flow)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session && !settled) {
          settled = true;
          setReady(true);
          subscription.unsubscribe();
        }
      });

      // If nothing arrives in 8s, the session is gone — send back to login
      const t = setTimeout(() => {
        if (!settled) {
          settled = true;
          subscription.unsubscribe();
          setSessionError("Your reset link has expired. Please request a new one.");
        }
      }, 8000);

      return () => { subscription.unsubscribe(); clearTimeout(t); };
    }

    checkSession();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm)  { setError("Passwords do not match."); return; }

    setLoading(true);
    const { data, error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) { setError(updateError.message); setLoading(false); return; }

    const { data: profile, error: profileError } = await supabase
      .from("admin_users")
      .select("name, role, initials")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile) {
      await supabase.auth.signOut();
      setError("Password saved, but your account is not yet in the system. Ask the administrator to add your profile, then log in normally.");
      setLoading(false);
      return;
    }

    setSuccess(true);
    setAuthUser({ id: data.user.id, email: data.user.email, ...profile });
    setTimeout(() => router.replace("/dashboard"), 1500);
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* ── Left branding strip ── */}
      <div className="relative lg:w-[40%] h-40 lg:h-screen flex-shrink-0">
        <Image src="/school-building.jpg" alt="Satyam Stars International School" fill className="object-cover object-center" priority />
        <div className="absolute inset-0 bg-gradient-to-br from-[#152d4a]/95 via-[#1e3a5f]/85 to-[#2a4f7c]/80" />
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-white">
          <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-2xl mb-4 bg-white flex items-center justify-center">
            <Image src="/school-logo.jpg" alt="Logo" width={80} height={80} className="object-contain w-full h-full" />
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold text-center">Satyam Stars</h1>
          <h2 className="text-lg font-semibold text-[#f59e0b] text-center mt-0.5">International School</h2>
          <p className="hidden lg:block text-white/60 text-xs text-center mt-3 max-w-xs">
            Empowering Education, Simplifying Administration
          </p>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-gray-50">
        <div className="w-full max-w-md">

          {/* ─── SESSION EXPIRED ─── */}
          {sessionError ? (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Link Expired</h2>
                <p className="text-gray-500 text-sm mt-1">{sessionError}</p>
              </div>
              <button onClick={() => router.replace("/login")}
                className="w-full bg-[#1e3a5f] hover:bg-[#152d4a] text-white py-3 rounded-xl font-semibold text-sm transition-all">
                Go to Login
              </button>
            </div>
          ) : !ready ? (
            /* ─── CHECKING SESSION ─── */
            <div className="text-center space-y-4">
              <div className="w-10 h-10 border-2 border-[#1e3a5f]/30 border-t-[#1e3a5f] rounded-full animate-spin mx-auto" />
              <p className="text-sm text-gray-500">Verifying your reset link...</p>
            </div>
          ) : success ? (
            /* ─── SUCCESS ─── */
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto">
                <ShieldCheck className="w-8 h-8 text-green-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Password Updated!</h2>
                <p className="text-gray-500 text-sm mt-1">Redirecting you to the dashboard...</p>
              </div>
              <div className="w-8 h-8 border-2 border-[#1e3a5f]/30 border-t-[#1e3a5f] rounded-full animate-spin mx-auto" />
            </div>
          ) : (
            /* ─── PASSWORD FORM ─── */
            <>
              <div className="mb-8">
                <div className="w-12 h-12 bg-[#1e3a5f] rounded-xl flex items-center justify-center mb-4">
                  <Lock className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl lg:text-3xl font-bold text-[#1e3a5f]">Set New Password</h2>
                <p className="text-gray-500 text-sm mt-1.5">
                  Create a strong password to secure your account
                </p>
              </div>

              {error && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type={showP ? "text" : "password"} value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 8 characters" required
                      className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] transition-all placeholder:text-gray-300" />
                    <button type="button" onClick={() => setShowP(!showP)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                      {showP ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {password && password.length < 8 && (
                    <p className="text-xs text-amber-600 mt-1">At least 8 characters required ({password.length}/8)</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type={showC ? "text" : "password"} value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Re-enter your password" required
                      className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] transition-all placeholder:text-gray-300" />
                    <button type="button" onClick={() => setShowC(!showC)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                      {showC ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirm && password !== confirm && (
                    <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                  )}
                  {confirm && password === confirm && confirm.length >= 8 && (
                    <p className="text-xs text-green-600 mt-1">Passwords match</p>
                  )}
                </div>

                <button type="submit" disabled={loading}
                  className="w-full bg-[#1e3a5f] hover:bg-[#152d4a] text-white py-3 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-[#1e3a5f]/20">
                  {loading
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>
                    : "Set Password & Sign In"}
                </button>
              </form>

              <div className="mt-6 p-3 bg-[#f59e0b]/10 rounded-xl border border-[#f59e0b]/20 text-center">
                <p className="text-xs text-gray-600">
                  <span className="font-semibold text-[#1e3a5f]">Tip:</span> Use a mix of letters, numbers and symbols for a strong password
                </p>
              </div>
            </>
          )}

          <div className="mt-8 text-center">
            <p className="text-xs text-gray-400">© 2026 Satyam Stars International School</p>
          </div>
        </div>
      </div>
    </div>
  );
}
