"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { Turnstile, captchaEnabled } from "@/components/turnstile";
import { AuthBuddy } from "@/components/auth-buddy";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (captchaEnabled && !captchaToken) {
      setError("Please complete the CAPTCHA.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      window.turnstile?.reset();
      setCaptchaToken(null);
      return;
    }

    // Hard navigation so the session cookie is sent with the request.
    window.location.href = "/dashboard";
  }

  return (
    <div className="space-y-6">
      <AuthBuddy />
      <h1 className="text-2xl font-bold">Sign In</h1>
      <div className="w-full rounded-md border border-gray-200 bg-white p-4 shadow md:p-6">
        <form onSubmit={handleSignIn} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-200 p-3 text-sm">{error}</div>
          )}
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block h-12 w-full appearance-none rounded-md border border-gray-400 px-3 transition-colors placeholder:text-gray-500 focus:border-gray-600 focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block h-12 w-full appearance-none rounded-md border border-gray-400 px-3 transition-colors placeholder:text-gray-500 focus:border-gray-600 focus:outline-none"
            />
          </div>
          <Turnstile onVerify={setCaptchaToken} />
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-gray-100 px-4 py-2 shadow-sm transition-colors duration-300 hover:bg-gray-200 disabled:bg-gray-200 disabled:text-gray-700"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
      <div className="flex justify-between text-sm">
        <Link
          href="/reset-password"
          className="inline-block border-b border-black text-black transition-colors duration-300 hover:border-gray-600 hover:text-gray-600"
        >
          Forgot password?
        </Link>
        <Link
          href="/signup"
          className="inline-block border-b border-black text-black transition-colors duration-300 hover:border-gray-600 hover:text-gray-600"
        >
          Create account
        </Link>
      </div>
    </div>
  );
}
