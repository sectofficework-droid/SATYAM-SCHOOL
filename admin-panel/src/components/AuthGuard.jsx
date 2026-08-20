"use client";

import { useEffect, useState } from "react";
import supabase from "@/lib/supabase";
import useStore from "@/lib/store";
import { IdleTimerContext } from "@/lib/idleTimerContext";

const IDLE_LIMIT_SECONDS = 15 * 60;

// A full browser navigation, not router.replace() - instant since /login is
// statically servable with no server round-trip, and it fully tears down JS
// state so nothing can linger from the signed-out session.
function goToLogin() {
  window.location.replace("/login");
}

export default function AuthGuard({ children }) {
  const authUser = useStore((s) => s.authUser);
  const setAuthUser = useStore((s) => s.setAuthUser);
  const clearAuthUser = useStore((s) => s.clearAuthUser);
  const [checking, setChecking] = useState(true);
  const [revalidating, setRevalidating] = useState(false);
  const [idleSecondsLeft, setIdleSecondsLeft] = useState(IDLE_LIMIT_SECONDS);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        clearAuthUser();
        goToLogin();
        return;
      }

      if (!authUser) {
        const { data: profile } = await supabase
          .from("admin_users")
          .select("name, role, initials")
          .eq("id", session.user.id)
          .single();

        if (!profile) {
          try { await supabase.auth.signOut(); } catch {}
          clearAuthUser();
          goToLogin();
          return;
        }
        setAuthUser({ id: session.user.id, email: session.user.email, ...profile });
      }
      setChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        clearAuthUser();
        goToLogin();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Guards against the browser restoring a protected page from
  // back/forward cache (e.g. hitting Back, or re-entering a URL that
  // matches a bfcached entry) after sign-out - a bfcache restore revives
  // the page's old React state without re-running mount effects, so
  // without this it would show the stale logged-in view. Content is hidden
  // synchronously the instant a restore is detected (not just after the
  // session check resolves), otherwise the stale page still flashes on
  // screen before the redirect kicks in.
  useEffect(() => {
    const handlePageShow = (event) => {
      if (!event.persisted) return;
      setRevalidating(true);
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          clearAuthUser();
          goToLogin();
          return;
        }
        setRevalidating(false);
      });
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [clearAuthUser]);

  // Auto-logout after 15 minutes with no activity anywhere on the page. Any
  // activity resets the idle clock, so the timer only ever counts down while
  // the admin is genuinely away, not while they're working. Ticks every
  // second so Header can show a live countdown via IdleTimerContext.
  useEffect(() => {
    if (!authUser) return;

    let lastActivity = Date.now();
    const markActivity = () => { lastActivity = Date.now(); };

    const events = ["mousemove", "mousedown", "keydown", "wheel", "touchstart", "touchmove", "click"];
    events.forEach((evt) => window.addEventListener(evt, markActivity, { passive: true }));
    // "scroll" doesn't bubble, so a window-level listener misses scrolling
    // inside the app's own scrollable content area unless it's registered
    // for the capture phase, which does see it on the way down.
    window.addEventListener("scroll", markActivity, { passive: true, capture: true });

    const interval = setInterval(async () => {
      const secondsLeft = Math.max(0, IDLE_LIMIT_SECONDS - Math.floor((Date.now() - lastActivity) / 1000));
      setIdleSecondsLeft(secondsLeft);
      if (secondsLeft <= 0) {
        clearInterval(interval);
        try { await supabase.auth.signOut(); } catch {}
        clearAuthUser();
        goToLogin();
      }
    }, 1000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, markActivity));
      window.removeEventListener("scroll", markActivity, { capture: true });
      clearInterval(interval);
    };
  }, [authUser, clearAuthUser]);

  // Blank, not the loading spinner - this only fires for a background
  // bfcache re-check, and showing "Loading..." right before booting
  // someone out to /login reads as if it's logging them in.
  if (revalidating) return null;

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

  return (
    <IdleTimerContext.Provider value={idleSecondsLeft}>
      {children}
    </IdleTimerContext.Provider>
  );
}
