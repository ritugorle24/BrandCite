"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewDraftPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/drafts"
              className="flex items-center gap-2 text-slate-900 font-bold text-lg hover:text-indigo-600 transition-colors"
            >
              <span className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-base">
                B
              </span>
              <span>BrandCite</span>
            </Link>
            <span className="text-slate-300 font-light" aria-hidden="true">/</span>
            <span className="text-sm font-medium text-slate-600">New Draft</span>
          </div>

          <Link
            href="/drafts"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </header>

      {/* Main Form */}
      <main className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 flex-1">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Create New Draft</h1>
          <p className="text-sm text-slate-500 mt-1">
            Submit your marketing copy, blog post, or product description for instant automated guideline review.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800 flex items-start gap-2.5"
          >
            <span aria-hidden="true" className="font-bold text-rose-600">!</span>
            <div>
              <p className="font-semibold">Error Creating Draft</p>
              <p className="mt-0.5 text-rose-700">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div>
            <label
              htmlFor="draft-title"
              className="block text-sm font-semibold text-slate-800 mb-1.5"
            >
              Draft Title <span className="text-rose-500" aria-hidden="true">*</span>
            </label>
            <input
              id="draft-title"
              type="text"
              required
              disabled={loading}
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Summer Campaign - Morning Blend Announcement"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder:text-slate-400 text-sm focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-colors disabled:bg-slate-100 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label
              htmlFor="draft-content"
              className="block text-sm font-semibold text-slate-800 mb-1.5"
            >
              Draft Copy / Content <span className="text-rose-500" aria-hidden="true">*</span>
            </label>
            <textarea
              id="draft-content"
              required
              disabled={loading}
              rows={12}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste or write your copy here. E.g. Welcome everyone to NovaBrew's summer launch..."
              className="w-full px-4 py-3 rounded-lg border border-slate-300 text-slate-900 placeholder:text-slate-400 text-sm font-mono leading-relaxed focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-colors disabled:bg-slate-100 disabled:cursor-not-allowed resize-y min-h-[220px]"
            />
            <p className="text-xs text-slate-400 mt-1.5">
              Drafts will be analyzed against NovaBrew brand tone, terminology rules, approved claims, and accessibility guidelines.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <Link
              href="/drafts"
              className="px-4 py-2.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium shadow-sm transition-colors focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Analyzing Copy...</span>
                </>
              ) : (
                <span>Submit for Brand Review</span>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
