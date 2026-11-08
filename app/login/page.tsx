"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Please provide both email and password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const msg = String(data.error || "Login failed");
        if (msg.toLowerCase().includes("invalid login credentials")) {
          setError("Incorrect email or password. Please try again.");
        } else {
          setError(msg);
        }
        return;
      }

      router.replace("/drafts");
      router.refresh();
    } catch {
      setError("Unable to connect to server. Please check your network connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <section className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <header className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg">
              B
            </span>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">BrandCite</h1>
          </div>
          <p className="text-sm text-slate-500">
            Sign in to review and verify content against brand guidelines.
          </p>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-700 flex items-start gap-2"
          >
            <span aria-hidden="true" className="font-bold">!</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label
              htmlFor="email-input"
              className="block text-sm font-semibold text-slate-700 mb-1"
            >
              Email Address
            </label>
            <input
              id="email-input"
              type="email"
              name="email"
              autoComplete="email"
              required
              disabled={loading}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. creator@example.com"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder:text-slate-400 text-sm focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-colors disabled:bg-slate-100 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label
              htmlFor="password-input"
              className="block text-sm font-semibold text-slate-700 mb-1"
            >
              Password
            </label>
            <input
              id="password-input"
              type="password"
              name="password"
              autoComplete="current-password"
              required
              disabled={loading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder:text-slate-400 text-sm focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-colors disabled:bg-slate-100 disabled:cursor-not-allowed"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <footer className="mt-6 pt-6 border-t border-slate-100 text-center text-xs text-slate-500">
          BrandCite Brand Governance System &bull; Secure Authentication
        </footer>
      </section>
    </main>
  );
}
