"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import supabase from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Verifying your link...");

  useEffect(() => {
    const token_hash = searchParams.get("token_hash");
    const type = searchParams.get("type");

    if (!token_hash || !type) {
      setMessage("Invalid or missing verification link.");
      setTimeout(() => router.replace("/login"), 3000);
      return;
    }

    supabase.auth.verifyOtp({ token_hash, type }).then(({ error }) => {
      if (error) {
        setMessage("Link expired or already used. Request a new one.");
        setTimeout(() => router.replace("/login"), 3000);
        return;
      }
      if (type === "invite" || type === "recovery") {
        router.replace("/auth/set-password");
      } else {
        router.replace("/dashboard");
      }
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4">
        <div className="w-10 h-10 border-2 border-[#1e3a5f]/30 border-t-[#1e3a5f] rounded-full animate-spin mx-auto" />
        <p className="text-sm text-gray-600">{message}</p>
      </div>
    </div>
  );
}
