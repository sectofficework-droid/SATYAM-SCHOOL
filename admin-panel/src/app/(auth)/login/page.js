"use client";

import Image from "next/image";
import { useState, useEffect, Suspense } from "react";
import { Eye, EyeOff, Lock, Mail, MapPin, BookOpen, ArrowLeft } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { isValidEmail, isStrongPassword } from "@/lib/validators";
import supabase from "@/lib/supabase";
import useStore from "@/lib/store";

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuthUser = useStore((s) => s.setAuthUser);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [stats, setStats] = useState({ students: null, employees: null });
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  // Forward any auth codes that land here to the callback handler,
  // and handle hash-based PASSWORD_RECOVERY (implicit flow fallback).
  useEffect(() => {
    // PKCE: code in query params (e.g. ?code=xxx redirected from root or Supabase)
    const code      = searchParams.get("code");
    const tokenHash = searchParams.get("token_hash");
    if (code || tokenHash) {
      router.replace("/auth/callback?" + searchParams.toString());
      return;
    }

    // Implicit / hash flow: Supabase fires PASSWORD_RECOVERY when #access_token is in URL
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        router.replace("/auth/set-password");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    Promise.all([
      supabase.from("students").select("*", { count: "exact", head: true }),
      supabase.from("employees").select("*", { count: "exact", head: true }),
    ]).then(([s, e]) => {
      setStats({ students: s.count ?? null, employees: e.count ?? null });
    }).catch(() => {});
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); setInfo("");
    const errors = {};
    if (!isValidEmail(email)) errors.email = "Enter a valid email address.";
    if (!isStrongPassword(password, 6)) errors.password = "Password must be at least 6 characters.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setLoading(true);
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) { setError("Invalid email or password."); setLoading(false); return; }
    const { data: profile, error: profileError } = await supabase
      .from("admin_users").select("name, role, initials").eq("id", authData.user.id).single();
    if (profileError || !profile) {
      await supabase.auth.signOut();
      setError("Your account is not authorized for this system.");
      setLoading(false); return;
    }
    setAuthUser({ id: authData.user.id, email: authData.user.email, ...profile });
    sessionStorage.removeItem("tasksPopupShown");
    router.push("/dashboard");
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError(""); setInfo("");
    if (!isValidEmail(forgotEmail)) { setError("Enter a valid email address."); return; }
    setForgotLoading(true);
    const { error: e2 } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    });
    setForgotLoading(false);
    if (e2) { setError(e2.message); return; }
    setInfo("Password reset link sent! Check your email inbox (and spam folder).");
    setShowForgot(false);
    setForgotEmail("");
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* ── Left Panel ── */}
      <div className="relative lg:w-[58%] h-56 sm:h-72 lg:h-screen flex-shrink-0">
        <Image src="/school-building.jpg" alt="Satyam Stars International School Building" fill className="object-cover object-center" priority />
        <div className="absolute inset-0 bg-gradient-to-br from-[#152d4a]/95 via-[#1e3a5f]/85 to-[#2a4f7c]/80" />
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-white">
          <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-2xl mb-5 bg-white flex items-center justify-center">
            <Image src="/school-logo.jpg" alt="Logo" width={96} height={96} className="object-contain w-full h-full" />
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold text-center tracking-tight">Satyam Stars</h1>
          <h2 className="text-xl lg:text-2xl font-semibold text-[#f59e0b] text-center mt-1">International School</h2>
          <div className="flex items-center gap-2 mt-3">
            <div className="h-px w-12 bg-white/30" />
            <span className="text-white/60 text-xs font-medium uppercase tracking-widest">School Management</span>
            <div className="h-px w-12 bg-white/30" />
          </div>
          <p className="text-white/75 text-sm text-center mt-4 max-w-xs leading-relaxed">Empowering Education, Simplifying Administration</p>
          <div className="hidden lg:flex flex-col gap-2 mt-8 w-full max-w-xs">
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
              <MapPin className="w-3.5 h-3.5 text-[#f59e0b] flex-shrink-0" />
              <span className="text-white/80 text-xs">Surat, Gujarat, India</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
              <BookOpen className="w-3.5 h-3.5 text-[#f59e0b] flex-shrink-0" />
              <span className="text-white/80 text-xs">GSEB Board · English Medium</span>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-6 mt-8 pt-6 border-t border-white/15 w-full max-w-xs">
            <div className="text-center flex-1">
              <p className="text-2xl font-bold text-[#f59e0b]">{stats.students === null ? "—" : stats.students.toLocaleString("en-IN")}</p>
              <p className="text-xs text-white/60 mt-0.5">Students</p>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="text-center flex-1">
              <p className="text-2xl font-bold text-[#f59e0b]">{stats.employees === null ? "—" : stats.employees.toLocaleString("en-IN")}</p>
              <p className="text-xs text-white/60 mt-0.5">Faculty</p>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="text-center flex-1">
              <p className="text-2xl font-bold text-[#f59e0b]">GSEB</p>
              <p className="text-xs text-white/60 mt-0.5">Board</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-gray-50 min-h-screen lg:min-h-0">
        <div className="w-full max-w-md">

          {/* ── FORGOT PASSWORD FORM ── */}
          {showForgot ? (
            <>
              <button onClick={() => { setShowForgot(false); setError(""); setInfo(""); }}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#1e3a5f] mb-6 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Login
              </button>
              <div className="mb-8">
                <div className="w-12 h-12 bg-[#1e3a5f] rounded-xl flex items-center justify-center mb-4">
                  <Mail className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-[#1e3a5f]">Forgot Password?</h3>
                <p className="text-gray-500 text-sm mt-1.5">Enter your email and we'll send you a reset link.</p>
              </div>
              {error && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
              {info  && <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{info}</div>}
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                      placeholder="your@email.com" required
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] transition-all placeholder:text-gray-300" />
                  </div>
                </div>
                <button type="submit" disabled={forgotLoading}
                  className="w-full bg-[#1e3a5f] hover:bg-[#152d4a] text-white py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-[#1e3a5f]/20">
                  {forgotLoading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending...</> : "Send Reset Link"}
                </button>
              </form>
            </>
          ) : (
            <>
              {/* ── LOGIN FORM ── */}
              <div className="mb-8">
                <div className="inline-flex items-center gap-2 bg-[#1e3a5f]/10 text-[#1e3a5f] px-3 py-1.5 rounded-full text-xs font-semibold mb-4">
                  <div className="w-1.5 h-1.5 bg-[#f59e0b] rounded-full" />
                  Satyam School Administration
                </div>
                <h3 className="text-2xl lg:text-3xl font-bold text-[#1e3a5f]">Welcome Back</h3>
                <p className="text-gray-500 text-sm mt-1.5">Sign in to access the School Management System</p>
              </div>

              {error && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
              {info  && <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{info}</div>}

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="email" value={email}
                      onChange={(e) => { setEmail(e.target.value); setFieldErrors(p => ({ ...p, email: "" })); }}
                      placeholder="admin@satyamstars.edu.in" required
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] transition-all placeholder:text-gray-300" />
                  </div>
                  {fieldErrors.email && <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type={showPassword ? "text" : "password"} value={password}
                      onChange={(e) => { setPassword(e.target.value); setFieldErrors(p => ({ ...p, password: "" })); }}
                      placeholder="Enter your password" required
                      className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] transition-all placeholder:text-gray-300" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {fieldErrors.password && <p className="text-xs text-red-500 mt-1">{fieldErrors.password}</p>}
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" className="w-4 h-4 rounded border-gray-300 accent-[#1e3a5f]" />
                    <span className="text-sm text-gray-600">Remember me</span>
                  </label>
                  <button type="button" onClick={() => { setShowForgot(true); setError(""); setInfo(""); setForgotEmail(email); }}
                    className="text-sm text-[#1e3a5f] hover:text-[#f59e0b] font-medium transition-colors">
                    Forgot password?
                  </button>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full bg-[#1e3a5f] hover:bg-[#152d4a] text-white py-3 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-[#1e3a5f]/20">
                  {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Signing in...</> : "Sign In"}
                </button>
              </form>

              <div className="mt-6 p-3 bg-[#f59e0b]/10 rounded-xl border border-[#f59e0b]/20">
                <p className="text-xs text-gray-600 text-center">
                  <span className="font-semibold text-[#1e3a5f]">Roles supported:</span>{" "}
                  Management · Senior Admin · Admin
                </p>
              </div>
            </>
          )}

          <div className="mt-8 text-center">
            <p className="text-xs text-gray-400">© 2026 Satyam Stars International School</p>
            <p className="text-xs text-gray-400 mt-0.5">Surat, Gujarat · GSEB Board · All rights reserved</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-2 border-[#1e3a5f]/30 border-t-[#1e3a5f] rounded-full animate-spin" />
      </div>
    }>
      <LoginPageInner />
    </Suspense>
  );
}
