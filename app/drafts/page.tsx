"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

interface DraftSummary {
  id: string;
  title: string | null;
  status?: string;
  current_version?: number;
  created_at: string;
}

export default function DraftsListPage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

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

  const getStatusBadge = (status?: string) => {
    const s = (status || "draft").toLowerCase();
    switch (s) {
      case "approved":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "in_review":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "changes_requested":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const formatStatus = (status?: string) => {
    const s = (status || "draft").replace("_", " ");
    return s.toUpperCase();
  };

  const filteredDrafts = useMemo(() => {
    return drafts.filter((d) => {
      const matchesStatus =
        statusFilter === "all" || (d.status || "draft").toLowerCase() === statusFilter;
      const matchesSearch =
        !searchQuery ||
        (d.title || "Untitled Draft").toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [drafts, statusFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Unified Top Navigation */}
      <Navbar breadcrumb="Drafts" />

      {/* Main Content Area */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                Workspace
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Your Copy Drafts</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Drafts submitted for brand governance and guideline compliance checks.
            </p>
          </div>

          <Link
            href="/drafts/new"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm shadow-xs transition-colors"
          >
            <span aria-hidden="true" className="text-base font-bold">+</span>
            <span>Create New Draft</span>
          </Link>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 mb-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="inline-flex p-1 bg-slate-100 rounded-lg border border-slate-200/80 overflow-x-auto text-xs font-medium">
            {[
              { id: "all", label: "All Drafts" },
              { id: "draft", label: "Draft" },
              { id: "in_review", label: "In Review" },
              { id: "changes_requested", label: "Changes Requested" },
              { id: "approved", label: "Approved" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
                  statusFilter === tab.id
                    ? "bg-white text-slate-900 font-semibold shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search drafts..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 transition-colors"
            />
            <span className="absolute left-3 top-2 text-slate-400 text-xs">🔍</span>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div
            role="status"
            className="bg-white rounded-xl border border-slate-200/90 p-12 text-center shadow-xs"
          >
            <div className="inline-block w-7 h-7 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-slate-600 font-medium text-sm">Loading drafts...</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div
            role="alert"
            className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center text-rose-800 shadow-xs"
          >
            <p className="font-semibold text-base mb-1">Failed to Load Drafts</p>
            <p className="text-sm text-rose-700 mb-4">{error}</p>
            <button
              onClick={fetchDrafts}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredDrafts.length === 0 && (
          <section
            aria-label="No drafts"
            className="bg-white rounded-xl border border-slate-200/90 p-12 text-center shadow-xs"
          >
            <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3 font-bold text-xl">
              ✎
            </div>
            <h2 className="text-base font-bold text-slate-800 mb-1">No drafts found</h2>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mb-5">
              {drafts.length === 0
                ? "Create your first copy draft to check tone, terminology, claims, and accessibility compliance."
                : "No drafts match the selected filter."}
            </p>
            {drafts.length === 0 && (
              <Link
                href="/drafts/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs shadow-xs transition-colors"
              >
                <span>+ Create Your First Draft</span>
              </Link>
            )}
          </section>
        )}

        {/* Drafts List */}
        {!loading && !error && filteredDrafts.length > 0 && (
          <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
            <ul aria-label="Drafts list" className="divide-y divide-slate-100">
              {filteredDrafts.map((draft) => {
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
                      className="block hover:bg-slate-50/70 p-5 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-600"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <h2 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600">
                              {draft.title || "Untitled Draft"}
                            </h2>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase border ${getStatusBadge(
                                draft.status
                              )}`}
                            >
                              {formatStatus(draft.status)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            {draft.current_version ? `Version v${draft.current_version} • ` : ""}
                            Created {formattedDate}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 text-indigo-600 text-xs font-semibold">
                          <span>Open Workspace</span>
                          <span aria-hidden="true">&rarr;</span>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
