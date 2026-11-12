"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

export function EmailVerificationBanner({ email }: { email: string }) {
  const supabase = createClient();
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function resend() {
    setSending(true);
    await supabase.auth.resend({ type: "signup", email });
    setSent(true);
    setSending(false);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
      <div className="flex flex-col items-start justify-between gap-2 rounded-md bg-red-100 p-3 text-sm sm:flex-row sm:items-center">
        <span>
          Please verify your email address to access all features.
        </span>
        {sent ? (
          <span className="text-green-900">Verification email sent.</span>
        ) : (
          <button
            onClick={resend}
            disabled={sending}
            className="rounded-md bg-white px-3 py-1 font-medium shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            {sending ? "Sending..." : "Resend verification email"}
          </button>
        )}
      </div>
    </div>
  );
}
