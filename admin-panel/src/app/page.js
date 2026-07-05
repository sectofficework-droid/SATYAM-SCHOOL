import { redirect } from "next/navigation";

export default function RootPage({ searchParams }) {
  // Preserve auth codes from Supabase password-reset / invite email links.
  // Supabase redirects to the Site URL when redirectTo isn't in the allowlist —
  // this catches that case server-side before the code is lost.
  const code      = searchParams?.code;
  const tokenHash = searchParams?.token_hash;
  if (code || tokenHash) {
    const qs = Object.entries(searchParams)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");
    redirect("/auth/callback?" + qs);
  }
  redirect("/login");
}
