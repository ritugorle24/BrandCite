"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { generatePlainLanguageRuleNote } from "@/lib/knowledge";

interface RuleGapInsight {
  id: string;
  category: string;
  text: string;
  flagged?: number;
  times_flagged?: number;
  accepted?: number;
  times_accepted?: number;
  rejected?: number;
  times_rejected?: number;
  rejection_rate?: number;
  rejectionRate?: number;
  possibly_unclear?: boolean;
  possiblyUnclear?: boolean;
}

export default function InsightsPage() {
  const router = useRouter();

  const [rules, setRules] = useState<RuleGapInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  // Filters
  const [filterUnclearOnly, setFilterUnclearOnly] = useState(false);
  const [search, setSearch] = useState("");

  const fetchInsights = async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);

    try {
      const res = await fetch("/api/insights/gaps", {
        cache: "no-store",
      });

      if (!res.ok) {
        if (res.status === 401) {
          router.replace("/login?redirect=/insights");
          return;
        }
        if (res.status === 403) {
          setForbidden(true);
          setLoading(false);
          return;
        }
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP error ${res.status}`);
      }

      const data = await res.json();
      const list = data.gaps || data.rules || [];
      setRules(list);
    } catch (err: any) {
      setError(err.message || "Failed to load guideline gap insights.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  // Normalization helpers
  const getFlagged = (r: RuleGapInsight) => r.times_flagged ?? r.flagged ?? 0;
  const getAccepted = (r: RuleGapInsight) => r.times_accepted ?? r.accepted ?? 0;
  const getRejected = (r: RuleGapInsight) => r.times_rejected ?? r.rejected ?? 0;
  const getRejectionRate = (r: RuleGapInsight) => r.rejection_rate ?? r.rejectionRate ?? 0;
  const isPossiblyUnclear = (r: RuleGapInsight) => Boolean(r.possibly_unclear ?? r.possiblyUnclear);

  // Summary KPIs
  const totalMonitored = rules.length;
  const unclearCount = rules.filter(isPossiblyUnclear).length;
  const totalFlagged = rules.reduce((acc, r) => acc + getFlagged(r), 0);
  const highestRejection = rules.length > 0 ? Math.max(...rules.map(getRejectionRate)) : 0;

  // Filtered List
  const query = search.toLowerCase().trim();
  const displayedRules = rules.filter((r) => {
    if (filterUnclearOnly && !isPossiblyUnclear(r)) return false;
    if (!query) return true;
    return (
      r.id.toLowerCase().includes(query) ||
      r.category.toLowerCase().includes(query) ||
      r.text.toLowerCase().includes(query)
    );
  });

  // Forbidden / Non-manager View
  if (forbidden) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6 flex items-center justify-center">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-900/50 rounded-xl p-8 text-center shadow-sm">
          <div className="w-12 h-12 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
            🔒
          </div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
            Manager & Admin Access Only
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
            Guideline gap insights are reserved for managers and administrators to analyze brand rule clarity and reviewer consensus.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              href="/drafts"
              className="px-4 py-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-800 transition"
            >
              Return to My Drafts
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Top Navbar */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/drafts" className="text-xl font-bold tracking-tight text-amber-700 dark:text-amber-500">
              BrandCite
            </Link>
            <span className="text-zinc-400 dark:text-zinc-600">/</span>
            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              Guideline Gap Insights
            </span>
          </div>

          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link
              href="/drafts"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition"
            >
              Drafts
            </Link>
            <Link
              href="/approvals"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition"
            >
              Approvals
            </Link>
            <span className="text-amber-700 dark:text-amber-400 font-semibold border-b-2 border-amber-600 pb-0.5">
              Insights
            </span>
            <Link
              href="/admin/knowledge"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition"
            >
              Knowledge
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Description */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
            Guideline Gaps & Rule Rejection Analysis
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 max-w-3xl">
            Ranked list of brand rules based on reviewer feedback. A rule is marked as{" "}
            <strong className="text-amber-700 dark:text-amber-400 font-semibold">
              possibly unclear
            </strong>{" "}
            when it has been flagged at least 3 times and rejected at least 50% of the time.
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Total Monitored Rules
            </p>
            <p className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 mt-2">
              {totalMonitored}
            </p>
            <p className="text-xs text-zinc-500 mt-1">Active brand guidelines</p>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-900/50 rounded-xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
              Possibly Unclear Guidelines
            </p>
            <p className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-2">
              {unclearCount}
            </p>
            <p className="text-xs text-zinc-500 mt-1">≥3 flags & ≥50% rejection rate</p>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Total Rule Violations Flagged
            </p>
            <p className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 mt-2">
              {totalFlagged}
            </p>
            <p className="text-xs text-zinc-500 mt-1">Across all draft reviews</p>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Peak Rejection Rate
            </p>
            <p className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 mt-2">
              {Math.round(highestRejection * 100)}%
            </p>
            <p className="text-xs text-zinc-500 mt-1">Highest individual rule rejection</p>
          </div>
        </div>

        {/* Toolbar: Search and Filter */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 mb-6 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFilterUnclearOnly(false)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                !filterUnclearOnly
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm"
                  : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 hover:bg-zinc-200"
              }`}
            >
              All Rules ({rules.length})
            </button>
            <button
              onClick={() => setFilterUnclearOnly(true)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                filterUnclearOnly
                  ? "bg-amber-600 text-white shadow-sm"
                  : "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100"
              }`}
            >
              <span>⚠️</span>
              <span>Possibly Unclear Only ({unclearCount})</span>
            </button>
          </div>

          <div className="w-full sm:w-80">
            <label htmlFor="search-rules" className="sr-only">
              Search rules
            </label>
            <input
              id="search-rules"
              type="text"
              placeholder="Search by ID, category, or wording..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Loading / Error States */}
        {loading && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-12 text-center text-zinc-500 animate-pulse">
            Calculating guideline gap insights...
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 p-4 rounded-xl mb-6 text-sm">
            <p className="font-semibold">Unable to load insights</p>
            <p className="text-xs mt-1">{error}</p>
          </div>
        )}

        {/* RANKED TABLE */}
        {!loading && !error && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table
                className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-left text-sm"
                aria-label="Guideline Gap Insights Table"
              >
                <thead className="bg-zinc-50 dark:bg-zinc-950 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-center w-12">#</th>
                    <th scope="col" className="px-4 py-3">Rule</th>
                    <th scope="col" className="px-4 py-3">Category</th>
                    <th scope="col" className="px-4 py-3">Guideline Statement</th>
                    <th scope="col" className="px-4 py-3 text-right">Flagged</th>
                    <th scope="col" className="px-4 py-3 text-right">Accepted</th>
                    <th scope="col" className="px-4 py-3 text-right">Rejected</th>
                    <th scope="col" className="px-4 py-3 text-center">Rejection Rate</th>
                    <th scope="col" className="px-4 py-3 text-center">Clarity Status</th>
                    <th scope="col" className="px-4 py-3">Plain-Language Analysis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {displayedRules.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center text-zinc-500">
                        No rules found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    displayedRules.map((rule, idx) => {
                      const flagged = getFlagged(rule);
                      const accepted = getAccepted(rule);
                      const rejected = getRejected(rule);
                      const rejectionRate = getRejectionRate(rule);
                      const rejPct = Math.round(rejectionRate * 100);
                      const isUnclear = isPossiblyUnclear(rule);

                      const plainNote = generatePlainLanguageRuleNote({
                        flagged,
                        accepted,
                        rejected,
                        rejection_rate: rejectionRate,
                        possibly_unclear: isUnclear,
                      });

                      return (
                        <tr
                          key={rule.id}
                          className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition ${
                            isUnclear
                              ? "bg-amber-50/50 dark:bg-amber-950/20"
                              : ""
                          }`}
                        >
                          {/* Rank */}
                          <td className="px-4 py-4 text-center font-bold text-xs text-zinc-400">
                            {idx + 1}
                          </td>

                          {/* Rule ID */}
                          <td className="px-4 py-4 whitespace-nowrap font-mono font-bold text-xs text-amber-700 dark:text-amber-400">
                            {rule.id}
                          </td>

                          {/* Category */}
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                              {rule.category}
                            </span>
                          </td>

                          {/* Rule Text */}
                          <td className="px-4 py-4 max-w-xs">
                            <p className="text-xs text-zinc-800 dark:text-zinc-200 line-clamp-3">
                              {rule.text}
                            </p>
                          </td>

                          {/* Flagged */}
                          <td className="px-4 py-4 whitespace-nowrap text-right font-medium text-xs text-zinc-700 dark:text-zinc-300">
                            {flagged}
                          </td>

                          {/* Accepted */}
                          <td className="px-4 py-4 whitespace-nowrap text-right font-medium text-xs text-emerald-700 dark:text-emerald-400">
                            {accepted}
                          </td>

                          {/* Rejected */}
                          <td className="px-4 py-4 whitespace-nowrap text-right font-medium text-xs text-rose-700 dark:text-rose-400">
                            {rejected}
                          </td>

                          {/* Rejection Rate Progress */}
                          <td className="px-4 py-4 whitespace-nowrap text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span
                                className={`text-xs font-bold ${
                                  rejPct >= 50
                                    ? "text-rose-600 dark:text-rose-400"
                                    : rejPct > 0
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-zinc-400"
                                }`}
                              >
                                {rejPct}%
                              </span>
                              <div className="w-16 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    rejPct >= 50 ? "bg-rose-500" : "bg-amber-500"
                                  }`}
                                  style={{ width: `${Math.min(rejPct, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Clarity Status */}
                          <td className="px-4 py-4 whitespace-nowrap text-center">
                            {isUnclear ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-700">
                                <span>⚠️</span>
                                <span>Possibly Unclear</span>
                              </span>
                            ) : flagged >= 3 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                                Clear / Accepted
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                                Low Sample
                              </span>
                            )}
                          </td>

                          {/* Plain-Language Note */}
                          <td className="px-4 py-4 max-w-sm">
                            <p
                              className={`text-xs leading-relaxed ${
                                isUnclear
                                  ? "text-amber-900 dark:text-amber-200 font-medium bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200 dark:border-amber-900/60"
                                  : "text-zinc-600 dark:text-zinc-400"
                              }`}
                            >
                              {plainNote}
                            </p>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

