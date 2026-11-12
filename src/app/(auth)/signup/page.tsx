"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { generateHackerId } from "@/lib/utils";
import { Turnstile, captchaEnabled } from "@/components/turnstile";
import { AuthBuddy } from "@/components/auth-buddy";
import {
  validateInviteToken,
  claimStaffRole,
  createProfile,
} from "@/lib/actions/auth";

function SignUpForm() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const supabase = createClient();

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (captchaEnabled && !captchaToken) {
      setError("Please complete the CAPTCHA.");
      return;
    }

    setLoading(true);

    let staffRole: "reviewer" | "admin" | null = null;

    if (token) {
      const validation = await validateInviteToken(token);
      if (!validation.valid) {
        setError(validation.error || "Invalid invite token");
        setLoading(false);
        return;
      }
      staffRole = validation.role || null;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName },
        ...(captchaToken ? { captchaToken } : {}),
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      // Turnstile tokens are single-use; reset so the user can retry.
      window.turnstile?.reset();
      setCaptchaToken(null);
      return;
    }

    if (data.user) {
      const hhid = generateHackerId();

      // Best-effort profile creation. The auth user may not be visible to the
      // admin connection yet (FK race), so failures here are non-fatal: the
      // (app) layout guarantees a profile is created from user metadata on the
      // next request. We never block the user on this.
      try {
        await createProfile(data.user.id, firstName, lastName, hhid);
        if (token && staffRole) {
          await claimStaffRole(data.user.id, token);
        }
      } catch {
        // Ignore — profile is created by the app layout fallback.
      }
    }

    if (data.session) {
      // Hard navigation so the freshly-set session cookie is sent with the
      // request (a client-side router.push can race the cookie write and stall).
      window.location.href = "/dashboard";
    } else {
      setSuccess(true);
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Check Your Email</h1>
        <div className="w-full rounded-md border border-gray-200 bg-white p-4 shadow md:p-6 space-y-3">
          <p>We&apos;ve sent a verification link to <strong>{email}</strong>.</p>
          <p className="text-gray-500 text-sm">Click the link in your email to verify your account, then sign in.</p>
          <Link
            href="/signin"
            className="inline-block rounded-md bg-gray-100 px-4 py-2 shadow-sm transition-colors duration-300 hover:bg-gray-200"
          >
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AuthBuddy />
      <h1 className="text-2xl font-bold">{token ? "Staff Sign Up" : "Sign Up"}</h1>
      <div className="w-full rounded-md border border-gray-200 bg-white p-4 shadow md:p-6">
        <form onSubmit={handleSignUp} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-200 p-3 text-sm">{error}</div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="firstName" className="text-sm font-medium">
                First Name
              </label>
              <input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="mt-1 block h-12 w-full appearance-none rounded-md border border-gray-400 px-3 transition-colors placeholder:text-gray-500 focus:border-gray-600 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="lastName" className="text-sm font-medium">
                Last Name
              </label>
              <input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="mt-1 block h-12 w-full appearance-none rounded-md border border-gray-400 px-3 transition-colors placeholder:text-gray-500 focus:border-gray-600 focus:outline-none"
              />
            </div>
          </div>
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
          <div className="space-y-1">
            <label htmlFor="confirmPassword" className="text-sm font-medium">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>
      </div>
      <p className="text-sm">
        Already have an account?{" "}
        <Link
          href="/signin"
          className="inline-block border-b border-black text-black transition-colors duration-300 hover:border-gray-600 hover:text-gray-600"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="text-center py-8">Loading...</div>}>
      <SignUpForm />
    </Suspense>
  );
}
