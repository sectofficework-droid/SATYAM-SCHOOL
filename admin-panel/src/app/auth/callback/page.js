"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import supabase from "@/lib/supabase";

function Spinner({ message }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4">
        <div className="w-10 h-10 border-2 border-[#1e3a5f]/30 border-t-[#1e3a5f] rounded-full animate-spin mx-auto" />
        <p className="text-sm text-gray-600">{message}</p>
      </div>
    </div>
  );
}

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Verifying your link...");

  useEffect(() => {
    let done = false;

    const goToSetPassword = () => {
      if (done) return;
      done = true;
      router.replace("/auth/set-password");
    };

    const goToLogin = (msg) => {
      if (done) return;
      done = true;
      setMessage(msg);
      setTimeout(() => router.replace("/login"), 3000);
    };

    const code       = searchParams.get("code");
    const token_hash = searchParams.get("token_hash");
    const type       = searchParams.get("type");

    if (code) {
      // PKCE flow — exchange code, Supabase will fire PASSWORD_RECOVERY event
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) goToLogin("Link expired or already used. Request a new one from the login page.");
        else goToSetPassword();
      });
    } else if (token_hash && type) {
      // OTP flow
      supabase.auth.verifyOtp({ token_hash, type }).then(({ error }) => {
        if (error) goToLogin("Link expired or already used. Request a new one from the login page.");
        else goToSetPassword();
      });
    } else {
      // Hash-based implicit flow — Supabase auto-processes #access_token in URL and fires an event
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
          goToSetPassword();
        }
      });

      const timeout = setTimeout(() => {
        goToLogin("Invalid or expired link. Redirecting to login...");
      }, 5000);

      return () => {
        subscription.unsubscribe();
        clearTimeout(timeout);
      };
    }
  }, []);

  return <Spinner message={message} />;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<Spinner message="Verifying your link..." />}>
      <AuthCallbackInner />
    </Suspense>
  );
}
