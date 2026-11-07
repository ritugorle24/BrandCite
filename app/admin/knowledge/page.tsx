"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface BrandRule {
  id: string;
  category: string;
  text: string;
  severity: "low" | "medium" | "high";
  approved: boolean;
  approved_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface ApprovedFact {
  id: string;
  statement: string;
  source_note?: string | null;
  valid_until?: string | null;
  approved: boolean;
  created_at?: string;
  updated_at?: string;
}

interface TermItem {
  id: string;
  term: string;
  type: "preferred" | "banned";
  replacement?: string | null;
  rule_id?: string | null;
  approved: boolean;
  created_at?: string;
}

export default function AdminKnowledgePage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"rules" | "facts" | "terms">("rules");
  const [rules, setRules] = useState<BrandRule[]>([]);
  const [facts, setFacts] = useState<ApprovedFact[]>([]);
  const [terms, setTerms] = useState<TermItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [search, setSearch] = useState("");

  // Modal / Form state
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    entity: "rule" | "fact" | "term";
    data: any;
  } | null>(null);

  // Form fields
  const [formRule, setFormRule] = useState({
    id: "",
    category: "tone",
    text: "",
    severity: "medium" as "low" | "medium" | "high",
    approved: true,
  });

  const [formFact, setFormFact] = useState({
    id: "",
    statement: "",
    source_note: "",
    valid_until: "",
    approved: true,
  });

  const [formTerm, setFormTerm] = useState({
    term: "",
    type: "banned" as "preferred" | "banned",
    replacement: "",
    rule_id: "",
    approved: true,
  });

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchKnowledge = async () => {
    setLoading(true);
    setError(null);
    setAccessDenied(false);

    try {
      const res = await fetch("/api/admin/knowledge", {
        cache: "no-store",
      });

      if (!res.ok) {
        if (res.status === 401) {
          router.replace("/login?redirect=/admin/knowledge");
          return;
        }
        if (res.status === 403) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP error ${res.status}`);
      }

      const data = await res.json();
      setRules(data.rules || []);
      setFacts(data.facts || []);
      setTerms(data.terms || []);
    } catch (err: any) {
      setError(err.message || "Failed to load knowledge base items.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKnowledge();
  }, []);

  // Toggle approval switch handler
  const handleToggleApproval = async (
    entity: "rule" | "fact" | "term",
    id: string,
    currentApproved: boolean
  ) => {
    const nextApproved = !currentApproved;

    // Optimistic UI update
    if (entity === "rule") {
      setRules((prev) =>
        prev.map((r) => (r.id === id ? { ...r, approved: nextApproved } : r))
      );
    } else if (entity === "fact") {
      setFacts((prev) =>
        prev.map((f) => (f.id === id ? { ...f, approved: nextApproved } : f))
      );
    } else {
      setTerms((prev) =>
        prev.map((t) => (t.id === id ? { ...t, approved: nextApproved } : t))
      );
    }

    try {
      const res = await fetch("/api/admin/knowledge", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity,
          id,
          updates: { approved: nextApproved },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update approval status");
      }
    } catch (err: any) {
      alert(`Could not toggle approval: ${err.message}`);
      // Revert on error
      fetchKnowledge();
    }
  };

  // Submit Add Form
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    let payload: any = {};
    if (activeTab === "rules") {
      payload = { entity: "rule", data: formRule };
    } else if (activeTab === "facts") {
      payload = { entity: "fact", data: formFact };
    } else {
      payload = { entity: "term", data: formTerm };
    }

    try {
      const res = await fetch("/api/admin/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create item");
      }

      setIsAdding(false);
      resetForms();
      await fetchKnowledge();
    } catch (err: any) {
      setFormError(err.message || "Failed to create item.");
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Edit Form
  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch("/api/admin/knowledge", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: editingItem.entity,
          id: editingItem.data.id,
          updates: editingItem.data,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update item");
      }

      setEditingItem(null);
      await fetchKnowledge();
    } catch (err: any) {
      setFormError(err.message || "Failed to save changes.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForms = () => {
    setFormRule({
      id: "",
      category: "tone",
      text: "",
      severity: "medium",
      approved: true,
    });
    setFormFact({
      id: "",
      statement: "",
      source_note: "",
      valid_until: "",
      approved: true,
    });
    setFormTerm({
      term: "",
      type: "banned",
      replacement: "",
      rule_id: "",
      approved: true,
    });
    setFormError(null);
  };

  // Filtered items based on search input
  const query = search.toLowerCase().trim();
  const filteredRules = rules.filter(
    (r) =>
      r.id.toLowerCase().includes(query) ||
      r.category.toLowerCase().includes(query) ||
      r.text.toLowerCase().includes(query)
  );

  const filteredFacts = facts.filter(
    (f) =>
      f.id.toLowerCase().includes(query) ||
      f.statement.toLowerCase().includes(query) ||
      (f.source_note && f.source_note.toLowerCase().includes(query))
  );

  const filteredTerms = terms.filter(
    (t) =>
      t.term.toLowerCase().includes(query) ||
      (t.replacement && t.replacement.toLowerCase().includes(query)) ||
      (t.rule_id && t.rule_id.toLowerCase().includes(query))
  );

  // Access Denied State
  if (accessDenied) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6 flex items-center justify-center">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/50 rounded-xl p-8 text-center shadow-sm">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
            !
          </div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
            Admin Access Required
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
            Only administrators are authorized to view, add, edit, or approve BrandCite knowledge rules, facts, and terms.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              href="/drafts"
              className="px-4 py-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-800 transition"
            >
              Back to Drafts
            </Link>
            <Link
              href="/login"
              className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              Switch Account
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
              Knowledge Base Management
            </span>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              Admin Only
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
            <Link
              href="/insights"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition"
            >
              Insights
            </Link>
            <span className="text-amber-700 dark:text-amber-400 font-semibold border-b-2 border-amber-600 pb-0.5">
              Knowledge
            </span>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Heading & Notice */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
              Brand Governance Knowledge Base
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Manage approved brand rules, approved facts, and terminology.
              <strong className="text-zinc-900 dark:text-zinc-200 ml-1">
                Unapproved items are strictly excluded from AI and exact checks.
              </strong>
            </p>
          </div>

          <button
            onClick={() => {
              resetForms();
              setIsAdding(true);
            }}
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm transition"
          >
            + Add New {activeTab === "rules" ? "Rule" : activeTab === "facts" ? "Fact" : "Term"}
          </button>
        </div>

        {/* Search & Tabs Toolbar */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 mb-6 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 border-b sm:border-b-0 border-zinc-200 dark:border-zinc-800 pb-2 sm:pb-0">
            <button
              onClick={() => setActiveTab("rules")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === "rules"
                  ? "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 font-semibold"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              Brand Rules ({rules.length})
            </button>
            <button
              onClick={() => setActiveTab("facts")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === "facts"
                  ? "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 font-semibold"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              Approved Facts ({facts.length})
            </button>
            <button
              onClick={() => setActiveTab("terms")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === "terms"
                  ? "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 font-semibold"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              Terminology ({terms.length})
            </button>
          </div>

          <div className="w-full sm:w-72">
            <label htmlFor="search-input" className="sr-only">
              Search knowledge items
            </label>
            <input
              id="search-input"
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Global Loading / Error */}
        {loading && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-12 text-center text-zinc-500 animate-pulse">
            Loading knowledge items...
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 p-4 rounded-xl mb-6">
            <p className="font-semibold text-sm">Error loading knowledge base</p>
            <p className="text-xs mt-1">{error}</p>
          </div>
        )}

        {/* Section: RULES TABLE */}
        {!loading && !error && activeTab === "rules" && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-left text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-950 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-6 py-3">Rule ID</th>
                    <th scope="col" className="px-6 py-3">Category</th>
                    <th scope="col" className="px-6 py-3">Severity</th>
                    <th scope="col" className="px-6 py-3">Rule Statement</th>
                    <th scope="col" className="px-6 py-3 text-center">Approved Toggle</th>
                    <th scope="col" className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {filteredRules.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                        No brand rules match your search.
                      </td>
                    </tr>
                  ) : (
                    filteredRules.map((r) => (
                      <tr
                        key={r.id}
                        className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition ${
                          !r.approved ? "bg-zinc-50/60 dark:bg-zinc-900/40 opacity-75" : ""
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap font-mono font-bold text-xs text-amber-700 dark:text-amber-400">
                          {r.id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                            {r.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                              r.severity === "high"
                                ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                                : r.severity === "medium"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            }`}
                          >
                            {r.severity}
                          </span>
                        </td>
                        <td className="px-6 py-4 max-w-md">
                          <p className="text-zinc-800 dark:text-zinc-200 line-clamp-3">{r.text}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleApproval("rule", r.id, r.approved)}
                            aria-label={`Toggle approval for rule ${r.id}`}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition border ${
                              r.approved
                                ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 hover:bg-emerald-100"
                                : "bg-zinc-100 text-zinc-500 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 hover:bg-zinc-200"
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                r.approved ? "bg-emerald-500" : "bg-zinc-400"
                              }`}
                            />
                            {r.approved ? "✓ Approved" : "✕ Unapproved"}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() =>
                              setEditingItem({
                                entity: "rule",
                                data: { ...r },
                              })
                            }
                            className="text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 underline font-medium"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Section: FACTS TABLE */}
        {!loading && !error && activeTab === "facts" && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-left text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-950 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-6 py-3">Fact ID</th>
                    <th scope="col" className="px-6 py-3">Approved Statement</th>
                    <th scope="col" className="px-6 py-3">Source Citation</th>
                    <th scope="col" className="px-6 py-3">Expiry Date</th>
                    <th scope="col" className="px-6 py-3 text-center">Approved Toggle</th>
                    <th scope="col" className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {filteredFacts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                        No approved facts match your search.
                      </td>
                    </tr>
                  ) : (
                    filteredFacts.map((f) => {
                      const isExpired = f.valid_until && new Date(f.valid_until) < new Date();
                      return (
                        <tr
                          key={f.id}
                          className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition ${
                            !f.approved ? "bg-zinc-50/60 dark:bg-zinc-900/40 opacity-75" : ""
                          }`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap font-mono font-bold text-xs text-amber-700 dark:text-amber-400">
                            {f.id}
                          </td>
                          <td className="px-6 py-4 max-w-sm">
                            <p className="text-zinc-900 dark:text-zinc-100 font-medium">{f.statement}</p>
                          </td>
                          <td className="px-6 py-4 max-w-xs text-xs text-zinc-500 dark:text-zinc-400">
                            {f.source_note || "—"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {f.valid_until ? (
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  isExpired
                                    ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 font-semibold"
                                    : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                                }`}
                              >
                                {isExpired ? `Expired: ${f.valid_until}` : `Valid until ${f.valid_until}`}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                Perpetual
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleApproval("fact", f.id, f.approved)}
                              aria-label={`Toggle approval for fact ${f.id}`}
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition border ${
                                f.approved
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 hover:bg-emerald-100"
                                  : "bg-zinc-100 text-zinc-500 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 hover:bg-zinc-200"
                              }`}
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  f.approved ? "bg-emerald-500" : "bg-zinc-400"
                                }`}
                              />
                              {f.approved ? "✓ Approved" : "✕ Unapproved"}
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <button
                              onClick={() =>
                                setEditingItem({
                                  entity: "fact",
                                  data: { ...f, valid_until: f.valid_until || "" },
                                })
                              }
                              className="text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 underline font-medium"
                            >
                              Edit
                            </button>
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

        {/* Section: TERMS TABLE */}
        {!loading && !error && activeTab === "terms" && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-left text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-950 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-6 py-3">Term</th>
                    <th scope="col" className="px-6 py-3">Type</th>
                    <th scope="col" className="px-6 py-3">Preferred Alternative / Rule Note</th>
                    <th scope="col" className="px-6 py-3">Governing Rule</th>
                    <th scope="col" className="px-6 py-3 text-center">Approved Toggle</th>
                    <th scope="col" className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {filteredTerms.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                        No terms match your search.
                      </td>
                    </tr>
                  ) : (
                    filteredTerms.map((t) => (
                      <tr
                        key={t.id}
                        className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition ${
                          !t.approved ? "bg-zinc-50/60 dark:bg-zinc-900/40 opacity-75" : ""
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap font-semibold text-zinc-900 dark:text-zinc-100">
                          {t.term}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                              t.type === "banned"
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            }`}
                          >
                            {t.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-zinc-600 dark:text-zinc-400">
                          {t.replacement ? (
                            <span>
                              Use: <strong className="text-zinc-800 dark:text-zinc-200">{t.replacement}</strong>
                            </span>
                          ) : (
                            <span className="text-zinc-400">None</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-amber-700 dark:text-amber-400">
                          {t.rule_id || "—"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleApproval("term", t.id, t.approved)}
                            aria-label={`Toggle approval for term ${t.term}`}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition border ${
                              t.approved
                                ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 hover:bg-emerald-100"
                                : "bg-zinc-100 text-zinc-500 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 hover:bg-zinc-200"
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                t.approved ? "bg-emerald-500" : "bg-zinc-400"
                              }`}
                            />
                            {t.approved ? "✓ Approved" : "✕ Unapproved"}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() =>
                              setEditingItem({
                                entity: "term",
                                data: { ...t },
                              })
                            }
                            className="text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 underline font-medium"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL: ADD ITEM */}
        {isAdding && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  Add New {activeTab === "rules" ? "Brand Rule" : activeTab === "facts" ? "Approved Fact" : "Term"}
                </h2>
                <button
                  onClick={() => setIsAdding(false)}
                  className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-xl font-bold"
                >
                  &times;
                </button>
              </div>

              {formError && (
                <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 text-red-700 dark:text-red-300 text-xs">
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreateItem} className="mt-4 space-y-4">
                {activeTab === "rules" && (
                  <>
                    <div>
                      <label htmlFor="add-rule-id" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Rule ID (e.g. R-TONE-05) *
                      </label>
                      <input
                        id="add-rule-id"
                        type="text"
                        required
                        value={formRule.id}
                        onChange={(e) => setFormRule({ ...formRule, id: e.target.value })}
                        placeholder="R-TONE-05"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="add-rule-category" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Category *
                      </label>
                      <select
                        id="add-rule-category"
                        value={formRule.category}
                        onChange={(e) => setFormRule({ ...formRule, category: e.target.value })}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-amber-500 outline-none"
                      >
                        <option value="tone">Tone</option>
                        <option value="terminology">Terminology</option>
                        <option value="claims">Claims</option>
                        <option value="accessibility">Accessibility</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="add-rule-severity" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Severity
                      </label>
                      <select
                        id="add-rule-severity"
                        value={formRule.severity}
                        onChange={(e) => setFormRule({ ...formRule, severity: e.target.value as any })}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-amber-500 outline-none"
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="add-rule-text" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Rule Body Text *
                      </label>
                      <textarea
                        id="add-rule-text"
                        required
                        rows={3}
                        value={formRule.text}
                        onChange={(e) => setFormRule({ ...formRule, text: e.target.value })}
                        placeholder="Describe the exact brand guideline..."
                        className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <input
                        id="add-rule-approved"
                        type="checkbox"
                        checked={formRule.approved}
                        onChange={(e) => setFormRule({ ...formRule, approved: e.target.checked })}
                        className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                      />
                      <label htmlFor="add-rule-approved" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        Mark as Approved immediately
                      </label>
                    </div>
                  </>
                )}

                {activeTab === "facts" && (
                  <>
                    <div>
                      <label htmlFor="add-fact-id" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Fact ID (e.g. F-SUST-03) *
                      </label>
                      <input
                        id="add-fact-id"
                        type="text"
                        required
                        value={formFact.id}
                        onChange={(e) => setFormFact({ ...formFact, id: e.target.value })}
                        placeholder="F-SUST-03"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="add-fact-statement" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Fact Statement *
                      </label>
                      <textarea
                        id="add-fact-statement"
                        required
                        rows={3}
                        value={formFact.statement}
                        onChange={(e) => setFormFact({ ...formFact, statement: e.target.value })}
                        placeholder="e.g. NovaBrew 100% of packaging is recyclable."
                        className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="add-fact-source" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Source Note / Citation
                      </label>
                      <input
                        id="add-fact-source"
                        type="text"
                        value={formFact.source_note}
                        onChange={(e) => setFormFact({ ...formFact, source_note: e.target.value })}
                        placeholder="e.g. Audit Report 2025, p. 12"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="add-fact-expiry" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Expiry Date (leave empty if perpetual)
                      </label>
                      <input
                        id="add-fact-expiry"
                        type="date"
                        value={formFact.valid_until}
                        onChange={(e) => setFormFact({ ...formFact, valid_until: e.target.value })}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <input
                        id="add-fact-approved"
                        type="checkbox"
                        checked={formFact.approved}
                        onChange={(e) => setFormFact({ ...formFact, approved: e.target.checked })}
                        className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                      />
                      <label htmlFor="add-fact-approved" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        Mark as Approved immediately
                      </label>
                    </div>
                  </>
                )}

                {activeTab === "terms" && (
                  <>
                    <div>
                      <label htmlFor="add-term-word" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Term *
                      </label>
                      <input
                        id="add-term-word"
                        type="text"
                        required
                        value={formTerm.term}
                        onChange={(e) => setFormTerm({ ...formTerm, term: e.target.value })}
                        placeholder="e.g. Nova Brew"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="add-term-type" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Term Type *
                      </label>
                      <select
                        id="add-term-type"
                        value={formTerm.type}
                        onChange={(e) => setFormTerm({ ...formTerm, type: e.target.value as any })}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-amber-500 outline-none"
                      >
                        <option value="banned">Banned</option>
                        <option value="preferred">Preferred</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="add-term-replacement" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Replacement / Suggested Alternative
                      </label>
                      <input
                        id="add-term-replacement"
                        type="text"
                        value={formTerm.replacement}
                        onChange={(e) => setFormTerm({ ...formTerm, replacement: e.target.value })}
                        placeholder="e.g. NovaBrew"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="add-term-rule" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Governing Rule ID (optional)
                      </label>
                      <input
                        id="add-term-rule"
                        type="text"
                        value={formTerm.rule_id}
                        onChange={(e) => setFormTerm({ ...formTerm, rule_id: e.target.value })}
                        placeholder="e.g. R-TERM-01"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <input
                        id="add-term-approved"
                        type="checkbox"
                        checked={formTerm.approved}
                        onChange={(e) => setFormTerm({ ...formTerm, approved: e.target.checked })}
                        className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                      />
                      <label htmlFor="add-term-approved" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        Mark as Approved immediately
                      </label>
                    </div>
                  </>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {submitting ? "Saving..." : "Create Item"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: EDIT ITEM */}
        {editingItem && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  Edit {editingItem.entity === "rule" ? "Rule" : editingItem.entity === "fact" ? "Fact" : "Term"}
                </h2>
                <button
                  onClick={() => setEditingItem(null)}
                  className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-xl font-bold"
                >
                  &times;
                </button>
              </div>

              {formError && (
                <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 text-red-700 dark:text-red-300 text-xs">
                  {formError}
                </div>
              )}

              <form onSubmit={handleUpdateItem} className="mt-4 space-y-4">
                {editingItem.entity === "rule" && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-500 mb-1">Rule ID</label>
                      <input
                        type="text"
                        disabled
                        value={editingItem.data.id}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 font-mono text-zinc-500 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-rule-category" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Category
                      </label>
                      <select
                        id="edit-rule-category"
                        value={editingItem.data.category}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: { ...editingItem.data, category: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-amber-500 outline-none"
                      >
                        <option value="tone">Tone</option>
                        <option value="terminology">Terminology</option>
                        <option value="claims">Claims</option>
                        <option value="accessibility">Accessibility</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="edit-rule-severity" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Severity
                      </label>
                      <select
                        id="edit-rule-severity"
                        value={editingItem.data.severity}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: { ...editingItem.data, severity: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-amber-500 outline-none"
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="edit-rule-text" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Rule Text
                      </label>
                      <textarea
                        id="edit-rule-text"
                        rows={4}
                        value={editingItem.data.text}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: { ...editingItem.data, text: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                    </div>
                  </>
                )}

                {editingItem.entity === "fact" && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-500 mb-1">Fact ID</label>
                      <input
                        type="text"
                        disabled
                        value={editingItem.data.id}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 font-mono text-zinc-500 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-fact-statement" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Fact Statement
                      </label>
                      <textarea
                        id="edit-fact-statement"
                        rows={3}
                        value={editingItem.data.statement}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: { ...editingItem.data, statement: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-fact-source" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Source Note
                      </label>
                      <input
                        id="edit-fact-source"
                        type="text"
                        value={editingItem.data.source_note || ""}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: { ...editingItem.data, source_note: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-fact-expiry" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Expiry Date (leave blank for perpetual)
                      </label>
                      <input
                        id="edit-fact-expiry"
                        type="date"
                        value={editingItem.data.valid_until || ""}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: { ...editingItem.data, valid_until: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                    </div>
                  </>
                )}

                {editingItem.entity === "term" && (
                  <>
                    <div>
                      <label htmlFor="edit-term-word" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Term
                      </label>
                      <input
                        id="edit-term-word"
                        type="text"
                        value={editingItem.data.term}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: { ...editingItem.data, term: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-term-type" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Term Type
                      </label>
                      <select
                        id="edit-term-type"
                        value={editingItem.data.type}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: { ...editingItem.data, type: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-amber-500 outline-none"
                      >
                        <option value="banned">Banned</option>
                        <option value="preferred">Preferred</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="edit-term-replacement" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Replacement / Suggested Alternative
                      </label>
                      <input
                        id="edit-term-replacement"
                        type="text"
                        value={editingItem.data.replacement || ""}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: { ...editingItem.data, replacement: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-term-rule" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Governing Rule ID
                      </label>
                      <input
                        id="edit-term-rule"
                        type="text"
                        value={editingItem.data.rule_id || ""}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: { ...editingItem.data, rule_id: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                    </div>
                  </>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setEditingItem(null)}
                    className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {submitting ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

