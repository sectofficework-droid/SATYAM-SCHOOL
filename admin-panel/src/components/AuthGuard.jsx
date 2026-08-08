"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabase";
import useStore from "@/lib/store";

export default function AuthGuard({ children }) {
  const router = useRouter();
  const authUser = useStore((s) => s.authUser);
  const setAuthUser = useStore((s) => s.setAuthUser);
  const clearAuthUser = useStore((s) => s.clearAuthUser);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        clearAuthUser();
        router.replace("/login");
        return;
      }

      if (!authUser) {
        const { data: profile } = await supabase
          .from("admin_users")
          .select("name, role, initials")
          .eq("id", session.user.id)
          .single();

        if (!profile) {
          await supabase.auth.signOut();
          clearAuthUser();
          router.replace("/login");
          return;
        }
        setAuthUser({ id: session.user.id, email: session.user.email, ...profile });
      }
      setChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        clearAuthUser();
        router.replace("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Auto-logout after 10 minutes with no mouse/keyboard/touch/scroll activity.
  // Any activity resets the idle clock, so the timer only ever counts down
  // while the admin is genuinely away, not while they're working.
  useEffect(() => {
    if (!authUser) return;

    const IDLE_LIMIT_MS = 10 * 60 * 1000;
    let lastActivity = Date.now();
    const markActivity = () => { lastActivity = Date.now(); };

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];
    events.forEach((evt) => window.addEventListener(evt, markActivity, { passive: true }));

    const interval = setInterval(async () => {
      if (Date.now() - lastActivity >= IDLE_LIMIT_MS) {
        clearInterval(interval);
        await supabase.auth.signOut();
        clearAuthUser();
        router.replace("/login");
      }
    }, 15000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, markActivity));
      clearInterval(interval);
    };
  }, [authUser, clearAuthUser, router]);

  if (checking && !authUser) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#1e3a5f]/20 border-t-[#1e3a5f] rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return children;
}
