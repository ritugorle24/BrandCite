"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface DraftSummary {
  id: string;
  title: string | null;
  created_at: string;
}

export default function DraftsListPage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDrafts = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/drafts", {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      if (!res.ok) {
        if (res.status === 401) {
          router.replace("/login?redirect=/drafts");
          return;
        }
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP Error ${res.status}`);
      }

      const data = await res.json();
      setDrafts(data.drafts ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load drafts. Please refresh and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrafts();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/drafts"
            className="flex items-center gap-2.5 text-slate-900 font-bold text-lg hover:text-indigo-600 transition-colors"
          >
            <span className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-base">
              B
            </span>
            <span>BrandCite</span>
          </Link>

          <nav aria-label="Main Navigation" className="flex items-center gap-3">
            <Link
              href="/drafts/new"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm shadow-sm transition-colors"
            >
              <span aria-hidden="true" className="text-base font-bold">+</span>
              <span>New Draft</span>
            </Link>
            <button
              onClick={handleLogout}
              className="px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium text-sm transition-colors"
            >
              Sign Out
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 flex-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Your Drafts</h1>
            <p className="text-sm text-slate-500 mt-1">
              Drafts submitted for brand governance and guideline compliance checks.
            </p>
          </div>
          <Link
            href="/drafts/new"
            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm shadow-sm transition-colors"
          >
            <span aria-hidden="true">+</span> Create New Draft
          </Link>
        </div>

        {/* Loading State */}
        {loading && (
          <div
            role="status"
            className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm"
          >
            <div className="inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-slate-600 font-medium text-sm">Loading your drafts...</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div
            role="alert"
            className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center text-rose-800 shadow-sm"
          >
            <p className="font-semibold text-base mb-1">Failed to Load Drafts</p>
            <p className="text-sm text-rose-700 mb-4">{error}</p>
            <button
              onClick={fetchDrafts}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && drafts.length === 0 && (
          <section
            aria-label="No drafts"
            className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center"
          >
            <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4 font-bold text-xl">
              ✎
            </div>
            <h2 className="text-lg font-semibold text-slate-800 mb-1">No drafts yet</h2>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
              Create your first copy draft to check tone, terminology, claims, and accessibility compliance.
            </p>
            <Link
              href="/drafts/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm shadow-sm transition-colors"
            >
              + Create Your First Draft
            </Link>
          </section>
        )}

        {/* Drafts List */}
        {!loading && !error && drafts.length > 0 && (
          <ul aria-label="Drafts list" className="space-y-3">
            {drafts.map((draft) => {
              const formattedDate = new Date(draft.created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <li key={draft.id}>
                  <Link
                    href={`/drafts/${draft.id}`}
                    className="block bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl p-5 shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-indigo-600"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h2 className="text-base font-semibold text-slate-900 group-hover:text-indigo-600">
                          {draft.title || "Untitled Draft"}
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">
                          Created {formattedDate}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-indigo-600 text-sm font-medium">
                        <span>Open Draft</span>
                        <span aria-hidden="true">&rarr;</span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
