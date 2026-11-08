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

  const fillDemo = (role: "creator" | "manager" | "admin") => {
    setEmail(`${role}.demo@example.com`);
    setPassword("DemoPassword123!");
    setError(null);
  };

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
          setError("Incorrect email or password. Please check your credentials.");
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
    <main className="min-h-screen flex flex-col justify-between bg-slate-50 text-slate-900 font-sans p-4">
      {/* Top minimal header */}
      <div className="max-w-md w-full mx-auto pt-6 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 text-slate-900 font-bold text-base hover:text-indigo-600 transition-colors"
        >
          <span className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-2xs">
            B
          </span>
          <span>BrandCite</span>
        </Link>
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
          NovaBrew Edition
        </span>
      </div>

      {/* Main card */}
      <section className="w-full max-w-md mx-auto bg-white rounded-xl shadow-xs border border-slate-200/90 p-8 my-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sign In</h1>
          <p className="text-sm text-slate-500 mt-1">
            Access brand governance workspace and review copy.
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
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
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
              placeholder="e.g. creator.demo@example.com"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder:text-slate-400 text-sm focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-colors disabled:bg-slate-100 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="password-input"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
              >
                Password
              </label>
            </div>
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
            className="w-full mt-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-xs transition-colors focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in..." : "Sign In to BrandCite"}
          </button>
        </form>

        {/* Demo Account Quick-Fill Buttons */}
        <div className="mt-6 pt-5 border-t border-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5">
            Quick Demo Autofill:
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => fillDemo("creator")}
              className="px-2.5 py-1.5 rounded-md border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 text-slate-700 hover:text-indigo-700 text-xs font-medium transition-colors"
            >
              Creator
            </button>
            <button
              type="button"
              onClick={() => fillDemo("manager")}
              className="px-2.5 py-1.5 rounded-md border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 text-slate-700 hover:text-indigo-700 text-xs font-medium transition-colors"
            >
              Manager
            </button>
            <button
              type="button"
              onClick={() => fillDemo("admin")}
              className="px-2.5 py-1.5 rounded-md border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 text-slate-700 hover:text-indigo-700 text-xs font-medium transition-colors"
            >
              Admin
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-400 pb-4">
        BrandCite &bull; Enterprise Brand Governance Platform
      </footer>
    </main>
  );
}
