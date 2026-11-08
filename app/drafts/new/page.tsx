"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";

export default function NewDraftPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSampleCopy = () => {
    setTitle("Summer Artisan Cold Brew Launch");
    setContent(
      "NovaBrew proudly introduces the world's best 100% organic espresso roast, guaranteed to boost your morning focus! Visit our cheap coffee store today to enjoy handcrafted beverages made with fair-trade beans certified until 2024."
    );
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    if (!trimmedTitle) {
      setError("Please enter a title for your draft.");
      return;
    }

    if (!trimmedContent) {
      setError("Please enter some draft content to review.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          content: trimmedContent,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401) {
          setError("Your session has expired. Please sign in again.");
          router.replace("/login?redirect=/drafts/new");
        } else {
          setError(data.error || "Unable to create your draft. Please try again.");
        }
        return;
      }

      if (!data.draftId) {
        setError("Draft created, but redirect failed. Please check your drafts list.");
        return;
      }

      router.push(`/drafts/${data.draftId}`);
    } catch {
      setError("Unable to connect to server. Please check your network connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Unified Top Navigation */}
      <Navbar breadcrumb="New Draft" />

      {/* Main Form */}
      <main className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 flex-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                Authoring
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Create New Draft</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Draft or paste copy for citation-backed brand compliance review.
            </p>
          </div>

          <button
            type="button"
            onClick={loadSampleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 text-slate-700 hover:text-indigo-700 font-medium text-xs transition-colors"
          >
            <span>✨</span>
            <span>Load Sample Copy</span>
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 flex items-start gap-2.5 shadow-2xs"
          >
            <span aria-hidden="true" className="font-bold">!</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-6">
          {/* Title input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="draft-title"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
              >
                Draft Title
              </label>
              <span className="text-[11px] text-slate-400">
                {title.length} / 200 max
              </span>
            </div>
            <input
              id="draft-title"
              type="text"
              required
              disabled={loading}
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q4 Sustainable Sourcing Announcement"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder:text-slate-400 text-sm focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-colors disabled:bg-slate-100 disabled:cursor-not-allowed"
            />
          </div>

          {/* Content textarea */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="draft-content"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
              >
                Marketing Copy Content
              </label>
              <span className="text-[11px] text-slate-400">
                {content.length} / 5,000 max
              </span>
            </div>
            <textarea
              id="draft-content"
              required
              disabled={loading}
              maxLength={5000}
              rows={10}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste or write your campaign text here. When submitted, BrandCite will cross-examine it against NovaBrew approved guidelines, terminology rules, and facts..."
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder:text-slate-400 text-sm focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-colors font-mono disabled:bg-slate-100 disabled:cursor-not-allowed leading-relaxed"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Link
              href="/drafts"
              className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium text-xs transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs shadow-xs transition-colors focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Creating Draft...</span>
                </>
              ) : (
                <span>Create & Open Workspace</span>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
