"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { generatePlainLanguageRuleNote } from "@/lib/knowledge";
import Navbar from "@/components/Navbar";

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
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <Navbar breadcrumb="Access Restricted" />
        <div className="flex-1 p-6 flex items-center justify-center">
          <div className="max-w-md w-full bg-white border border-amber-200 rounded-xl p-8 text-center shadow-xs">
            <div className="w-12 h-12 bg-amber-50 text-amber-700 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              🔒
            </div>
            <h1 className="text-lg font-bold text-slate-900 mb-2">
              Manager & Admin Access Only
            </h1>
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              Guideline gap insights are reserved for managers and administrators to analyze brand rule clarity and reviewer consensus.
            </p>
            <div className="flex justify-center gap-3">
              <Link
                href="/drafts"
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition shadow-xs"
              >
                Return to My Drafts
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar breadcrumb="Insights" />

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        {/* Header Description */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
              Analytics
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Guideline Gaps & Rule Rejection Analysis
          </h1>
          <p className="text-sm text-slate-500 mt-0.5 max-w-3xl">
            Ranked list of brand rules based on reviewer feedback. A rule is marked as{" "}
            <strong className="text-slate-800 font-semibold">
              possibly unclear
            </strong>{" "}
            when it has been flagged at least 3 times and rejected at least 50% of the time.
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Monitored Rules
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1.5">
              {totalMonitored}
            </p>
            <p className="text-xs text-slate-400 mt-1">Active brand guidelines</p>
          </div>

          <div className="bg-white border border-amber-200 rounded-xl p-5 shadow-xs">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
              Possibly Unclear Guidelines
            </p>
            <p className="text-2xl font-bold text-amber-700 mt-1.5">
              {unclearCount}
            </p>
            <p className="text-xs text-slate-400 mt-1">≥3 flags & ≥50% rejection</p>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Violations Flagged
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1.5">
              {totalFlagged}
            </p>
            <p className="text-xs text-slate-400 mt-1">Across all draft reviews</p>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Peak Rejection Rate
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1.5">
              {Math.round(highestRejection * 100)}%
            </p>
            <p className="text-xs text-slate-400 mt-1">Highest individual rule rejection</p>
          </div>
        </div>

        {/* Toolbar: Search and Filter */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 mb-6 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="inline-flex p-1 bg-slate-100 rounded-lg border border-slate-200/80 text-xs font-medium">
            <button
              onClick={() => setFilterUnclearOnly(false)}
              className={`px-3.5 py-1.5 rounded-md transition ${
                !filterUnclearOnly
                  ? "bg-white text-slate-900 font-semibold shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Rules ({rules.length})
            </button>
            <button
              onClick={() => setFilterUnclearOnly(true)}
              className={`px-3.5 py-1.5 rounded-md transition flex items-center gap-1.5 ${
                filterUnclearOnly
                  ? "bg-amber-600 text-white font-semibold shadow-2xs"
                  : "text-amber-800 hover:text-amber-900 hover:bg-amber-50/60"
              }`}
            >
              <span>⚠️</span>
              <span>Possibly Unclear ({unclearCount})</span>
            </button>
          </div>

          <div className="w-full sm:w-72">
            <label htmlFor="search-rules" className="sr-only">
              Search rules
            </label>
            <input
              id="search-rules"
              type="text"
              placeholder="Search by ID, category, or wording..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100"
            />
          </div>
        </div>

        {/* Loading / Error States */}
        {loading && (
          <div className="bg-white border border-slate-200/90 rounded-xl p-12 text-center text-slate-500 shadow-xs">
            <div className="inline-block w-7 h-7 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-slate-600 font-medium text-sm">Calculating guideline gap insights...</p>
          </div>
        )}

        {error && !loading && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl mb-6 text-xs shadow-xs">
            <p className="font-semibold text-sm">Unable to load insights</p>
            <p className="text-xs mt-1">{error}</p>
          </div>
        )}

        {/* RANKED TABLE */}
        {!loading && !error && (
          <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table
                className="min-w-full divide-y divide-slate-100 text-left text-sm"
                aria-label="Guideline Gap Insights Table"
              >
                <thead className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
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
                <tbody className="divide-y divide-slate-100">
                  {displayedRules.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center text-slate-500 text-xs">
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
                          className={`hover:bg-slate-50/60 transition-colors ${
                            isUnclear
                              ? "bg-amber-50/40"
                              : ""
                          }`}
                        >
                          {/* Rank */}
                          <td className="px-4 py-4 text-center font-bold text-xs text-slate-400">
                            {idx + 1}
                          </td>

                          {/* Rule ID */}
                          <td className="px-4 py-4 whitespace-nowrap font-mono font-bold text-xs text-indigo-700">
                            {rule.id}
                          </td>

                          {/* Category */}
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                              {rule.category}
                            </span>
                          </td>

                          {/* Rule Text */}
                          <td className="px-4 py-4 max-w-xs">
                            <p className="text-xs text-slate-800 leading-relaxed line-clamp-3">
                              {rule.text}
                            </p>
                          </td>

                          {/* Flagged */}
                          <td className="px-4 py-4 whitespace-nowrap text-right font-medium text-xs text-slate-700">
                            {flagged}
                          </td>

                          {/* Accepted */}
                          <td className="px-4 py-4 whitespace-nowrap text-right font-medium text-xs text-emerald-700">
                            {accepted}
                          </td>

                          {/* Rejected */}
                          <td className="px-4 py-4 whitespace-nowrap text-right font-medium text-xs text-rose-700">
                            {rejected}
                          </td>

                          {/* Rejection Rate Progress */}
                          <td className="px-4 py-4 whitespace-nowrap text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span
                                className={`text-xs font-bold ${
                                  rejPct >= 50
                                    ? "text-rose-600"
                                    : rejPct > 0
                                    ? "text-amber-600"
                                    : "text-slate-400"
                                }`}
                              >
                                {rejPct}%
                              </span>
                              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
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
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                                <span>⚠️</span>
                                <span>Possibly Unclear</span>
                              </span>
                            ) : flagged >= 3 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Clear / Accepted
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">
                                Low Sample
                              </span>
                            )}
                          </td>

                          {/* Plain-Language Note */}
                          <td className="px-4 py-4 max-w-sm">
                            <p
                              className={`text-xs leading-relaxed ${
                                isUnclear
                                  ? "text-amber-900 font-medium bg-amber-50 p-2 rounded-lg border border-amber-200/80"
                                  : "text-slate-600"
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
