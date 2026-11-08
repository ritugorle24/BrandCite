"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

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
        throw new Error(data.error || "Failed to toggle approved status.");
      }
    } catch (err: any) {
      alert(`Approval update failed: ${err.message}. Reverting.`);
      // Rollback
      if (entity === "rule") {
        setRules((prev) =>
          prev.map((r) => (r.id === id ? { ...r, approved: currentApproved } : r))
        );
      } else if (entity === "fact") {
        setFacts((prev) =>
          prev.map((f) => (f.id === id ? { ...f, approved: currentApproved } : f))
        );
      } else {
        setTerms((prev) =>
          prev.map((t) => (t.id === id ? { ...t, approved: currentApproved } : t))
        );
      }
    }
  };

  // Reset modal fields
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

  // Handle Add Form submission
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      let payload: any = { entity: activeTab };
      if (activeTab === "rules") {
        if (!formRule.id || !formRule.text) {
          throw new Error("Rule ID and Rule Statement are required.");
        }
        payload.item = formRule;
      } else if (activeTab === "facts") {
        if (!formFact.id || !formFact.statement) {
          throw new Error("Fact ID and Fact Statement are required.");
        }
        payload.item = {
          ...formFact,
          valid_until: formFact.valid_until || null,
        };
      } else {
        if (!formTerm.term) {
          throw new Error("Term is required.");
        }
        payload.item = {
          ...formTerm,
          rule_id: formTerm.rule_id || null,
        };
      }

      const res = await fetch("/api/admin/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to create knowledge item.");
      }

      setIsAdding(false);
      resetForms();
      await fetchKnowledge();
    } catch (err: any) {
      setFormError(err.message || "Failed to save item.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Edit Form submission
  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setFormError(null);
    setSubmitting(true);

    try {
      const { entity, data } = editingItem;
      const res = await fetch("/api/admin/knowledge", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity,
          id: data.id,
          updates: data,
        }),
      });

      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resData.error || "Failed to update item.");
      }

      setEditingItem(null);
      await fetchKnowledge();
    } catch (err: any) {
      setFormError(err.message || "Failed to update item.");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter lists based on search
  const filteredRules = rules.filter(
    (r) =>
      r.id.toLowerCase().includes(search.toLowerCase()) ||
      r.text.toLowerCase().includes(search.toLowerCase()) ||
      r.category.toLowerCase().includes(search.toLowerCase())
  );

  const filteredFacts = facts.filter(
    (f) =>
      f.id.toLowerCase().includes(search.toLowerCase()) ||
      f.statement.toLowerCase().includes(search.toLowerCase()) ||
      (f.source_note && f.source_note.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredTerms = terms.filter(
    (t) =>
      t.term.toLowerCase().includes(search.toLowerCase()) ||
      (t.replacement && t.replacement.toLowerCase().includes(search.toLowerCase())) ||
      (t.rule_id && t.rule_id.toLowerCase().includes(search.toLowerCase()))
  );

  // 403 Forbidden Access State
  if (accessDenied) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <Navbar breadcrumb="Admin Access Required" />
        <div className="flex-1 p-6 flex items-center justify-center">
          <div className="max-w-md w-full bg-white border border-rose-200 rounded-xl p-8 text-center shadow-xs">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              🚫
            </div>
            <h1 className="text-lg font-bold text-slate-900 mb-2">
              Administrator Access Required
            </h1>
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              Only administrators are authorized to view, add, edit, or approve BrandCite knowledge rules, facts, and terms.
            </p>
            <div className="flex justify-center gap-3">
              <Link
                href="/drafts"
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition shadow-xs"
              >
                Back to Drafts
              </Link>
              <Link
                href="/login"
                className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50 transition"
              >
                Switch Account
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
      <Navbar breadcrumb="Knowledge Base" />

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        {/* Page Heading & Notice */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                Governance
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                Admin Only
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Brand Governance Knowledge Base
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Manage approved brand rules, approved facts, and terminology.
              <strong className="text-slate-700 ml-1">
                Unapproved items are strictly excluded from AI and exact checks.
              </strong>
            </p>
          </div>

          <button
            onClick={() => {
              resetForms();
              setIsAdding(true);
            }}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition"
          >
            <span>+ Add New {activeTab === "rules" ? "Rule" : activeTab === "facts" ? "Fact" : "Term"}</span>
          </button>
        </div>

        {/* Search & Tabs Toolbar */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 mb-6 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="inline-flex p-1 bg-slate-100 rounded-lg border border-slate-200/80 overflow-x-auto text-xs font-medium">
            <button
              onClick={() => setActiveTab("rules")}
              className={`px-3.5 py-1.5 rounded-md whitespace-nowrap transition ${
                activeTab === "rules"
                  ? "bg-white text-slate-900 font-semibold shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Brand Rules ({rules.length})
            </button>
            <button
              onClick={() => setActiveTab("facts")}
              className={`px-3.5 py-1.5 rounded-md whitespace-nowrap transition ${
                activeTab === "facts"
                  ? "bg-white text-slate-900 font-semibold shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Approved Facts ({facts.length})
            </button>
            <button
              onClick={() => setActiveTab("terms")}
              className={`px-3.5 py-1.5 rounded-md whitespace-nowrap transition ${
                activeTab === "terms"
                  ? "bg-white text-slate-900 font-semibold shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Terminology ({terms.length})
            </button>
          </div>

          <div className="w-full sm:w-64">
            <label htmlFor="search-input" className="sr-only">
              Search knowledge items
            </label>
            <input
              id="search-input"
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100"
            />
          </div>
        </div>

        {/* Global Loading / Error */}
        {loading && (
          <div className="bg-white border border-slate-200/90 rounded-xl p-12 text-center text-slate-500 shadow-xs">
            <div className="inline-block w-7 h-7 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-slate-600 font-medium text-sm">Loading knowledge items...</p>
          </div>
        )}

        {error && !loading && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl mb-6 shadow-xs">
            <p className="font-semibold text-sm">Error loading knowledge base</p>
            <p className="text-xs mt-1">{error}</p>
          </div>
        )}

        {/* Section: RULES TABLE */}
        {!loading && !error && activeTab === "rules" && (
          <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
                <thead className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-6 py-3">Rule ID</th>
                    <th scope="col" className="px-6 py-3">Category</th>
                    <th scope="col" className="px-6 py-3">Severity</th>
                    <th scope="col" className="px-6 py-3">Rule Statement</th>
                    <th scope="col" className="px-6 py-3 text-center">Approved Toggle</th>
                    <th scope="col" className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRules.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-500 text-xs">
                        No brand rules match your search.
                      </td>
                    </tr>
                  ) : (
                    filteredRules.map((r) => (
                      <tr
                        key={r.id}
                        className={`hover:bg-slate-50/60 transition-colors ${
                          !r.approved ? "bg-slate-50/40 opacity-75" : ""
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap font-mono font-bold text-xs text-indigo-700">
                          {r.id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                            {r.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                              r.severity === "high"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : r.severity === "medium"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}
                          >
                            {r.severity}
                          </span>
                        </td>
                        <td className="px-6 py-4 max-w-md">
                          <p className="text-slate-800 text-xs leading-relaxed line-clamp-3">{r.text}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleApproval("rule", r.id, r.approved)}
                            aria-label={`Toggle approval for rule ${r.id}`}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition border ${
                              r.approved
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                r.approved ? "bg-emerald-500" : "bg-slate-400"
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
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
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
          <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
                <thead className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-6 py-3">Fact ID</th>
                    <th scope="col" className="px-6 py-3">Approved Statement</th>
                    <th scope="col" className="px-6 py-3">Source Citation</th>
                    <th scope="col" className="px-6 py-3">Expiry Date</th>
                    <th scope="col" className="px-6 py-3 text-center">Approved Toggle</th>
                    <th scope="col" className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFacts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-500 text-xs">
                        No approved facts match your search.
                      </td>
                    </tr>
                  ) : (
                    filteredFacts.map((f) => {
                      const isExpired = f.valid_until && new Date(f.valid_until) < new Date();
                      return (
                        <tr
                          key={f.id}
                          className={`hover:bg-slate-50/60 transition-colors ${
                            !f.approved ? "bg-slate-50/40 opacity-75" : ""
                          }`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap font-mono font-bold text-xs text-indigo-700">
                            {f.id}
                          </td>
                          <td className="px-6 py-4 max-w-sm">
                            <p className="text-slate-900 text-xs font-medium leading-relaxed">{f.statement}</p>
                          </td>
                          <td className="px-6 py-4 max-w-xs text-xs text-slate-500">
                            {f.source_note || "—"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {f.valid_until ? (
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                                  isExpired
                                    ? "bg-rose-50 text-rose-700 border-rose-200 font-semibold"
                                    : "bg-slate-100 text-slate-700 border-slate-200"
                                }`}
                              >
                                {isExpired ? `Expired: ${f.valid_until}` : `Valid until ${f.valid_until}`}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200">
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
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                  : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                              }`}
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  f.approved ? "bg-emerald-500" : "bg-slate-400"
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
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
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
          <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
                <thead className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-6 py-3">Term</th>
                    <th scope="col" className="px-6 py-3">Type</th>
                    <th scope="col" className="px-6 py-3">Preferred Alternative / Rule Note</th>
                    <th scope="col" className="px-6 py-3">Governing Rule</th>
                    <th scope="col" className="px-6 py-3 text-center">Approved Toggle</th>
                    <th scope="col" className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTerms.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-500 text-xs">
                        No terms match your search.
                      </td>
                    </tr>
                  ) : (
                    filteredTerms.map((t) => (
                      <tr
                        key={t.id}
                        className={`hover:bg-slate-50/60 transition-colors ${
                          !t.approved ? "bg-slate-50/40 opacity-75" : ""
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap font-semibold text-xs text-slate-900">
                          {t.term}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                              t.type === "banned"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            }`}
                          >
                            {t.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-600">
                          {t.replacement ? (
                            <span>
                              Use: <strong className="text-slate-900">{t.replacement}</strong>
                            </span>
                          ) : (
                            <span className="text-slate-400">None</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-indigo-700">
                          {t.rule_id || "—"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleApproval("term", t.id, t.approved)}
                            aria-label={`Toggle approval for term ${t.term}`}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition border ${
                              t.approved
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                t.approved ? "bg-emerald-500" : "bg-slate-400"
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
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
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
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200/90 rounded-xl max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900">
                  Add New {activeTab === "rules" ? "Brand Rule" : activeTab === "facts" ? "Approved Fact" : "Term"}
                </h2>
                <button
                  onClick={() => setIsAdding(false)}
                  className="text-slate-400 hover:text-slate-700 text-xl font-bold leading-none"
                >
                  &times;
                </button>
              </div>

              {formError && (
                <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreateItem} className="mt-4 space-y-4">
                {activeTab === "rules" && (
                  <>
                    <div>
                      <label htmlFor="add-rule-id" className="block text-xs font-semibold text-slate-700 mb-1">
                        Rule ID (e.g. R-TONE-05) *
                      </label>
                      <input
                        id="add-rule-id"
                        type="text"
                        required
                        value={formRule.id}
                        onChange={(e) => setFormRule({ ...formRule, id: e.target.value })}
                        placeholder="R-TONE-05"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="add-rule-category" className="block text-xs font-semibold text-slate-700 mb-1">
                        Category *
                      </label>
                      <select
                        id="add-rule-category"
                        value={formRule.category}
                        onChange={(e) => setFormRule({ ...formRule, category: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 outline-none"
                      >
                        <option value="tone">Tone</option>
                        <option value="terminology">Terminology</option>
                        <option value="claims">Claims</option>
                        <option value="accessibility">Accessibility</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="add-rule-severity" className="block text-xs font-semibold text-slate-700 mb-1">
                        Severity
                      </label>
                      <select
                        id="add-rule-severity"
                        value={formRule.severity}
                        onChange={(e) => setFormRule({ ...formRule, severity: e.target.value as any })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 outline-none"
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="add-rule-text" className="block text-xs font-semibold text-slate-700 mb-1">
                        Rule Body Text *
                      </label>
                      <textarea
                        id="add-rule-text"
                        required
                        rows={3}
                        value={formRule.text}
                        onChange={(e) => setFormRule({ ...formRule, text: e.target.value })}
                        placeholder="Describe the exact brand guideline..."
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        id="add-rule-approved"
                        type="checkbox"
                        checked={formRule.approved}
                        onChange={(e) => setFormRule({ ...formRule, approved: e.target.checked })}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <label htmlFor="add-rule-approved" className="text-xs font-medium text-slate-700">
                        Mark as Approved immediately
                      </label>
                    </div>
                  </>
                )}

                {activeTab === "facts" && (
                  <>
                    <div>
                      <label htmlFor="add-fact-id" className="block text-xs font-semibold text-slate-700 mb-1">
                        Fact ID (e.g. F-SUST-03) *
                      </label>
                      <input
                        id="add-fact-id"
                        type="text"
                        required
                        value={formFact.id}
                        onChange={(e) => setFormFact({ ...formFact, id: e.target.value })}
                        placeholder="F-SUST-03"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="add-fact-statement" className="block text-xs font-semibold text-slate-700 mb-1">
                        Fact Statement *
                      </label>
                      <textarea
                        id="add-fact-statement"
                        required
                        rows={3}
                        value={formFact.statement}
                        onChange={(e) => setFormFact({ ...formFact, statement: e.target.value })}
                        placeholder="e.g. NovaBrew 100% of packaging is recyclable."
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="add-fact-source" className="block text-xs font-semibold text-slate-700 mb-1">
                        Source Note / Citation
                      </label>
                      <input
                        id="add-fact-source"
                        type="text"
                        value={formFact.source_note}
                        onChange={(e) => setFormFact({ ...formFact, source_note: e.target.value })}
                        placeholder="e.g. Audit Report 2025, p. 12"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="add-fact-expiry" className="block text-xs font-semibold text-slate-700 mb-1">
                        Expiry Date (leave empty if perpetual)
                      </label>
                      <input
                        id="add-fact-expiry"
                        type="date"
                        value={formFact.valid_until}
                        onChange={(e) => setFormFact({ ...formFact, valid_until: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        id="add-fact-approved"
                        type="checkbox"
                        checked={formFact.approved}
                        onChange={(e) => setFormFact({ ...formFact, approved: e.target.checked })}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <label htmlFor="add-fact-approved" className="text-xs font-medium text-slate-700">
                        Mark as Approved immediately
                      </label>
                    </div>
                  </>
                )}

                {activeTab === "terms" && (
                  <>
                    <div>
                      <label htmlFor="add-term-word" className="block text-xs font-semibold text-slate-700 mb-1">
                        Term *
                      </label>
                      <input
                        id="add-term-word"
                        type="text"
                        required
                        value={formTerm.term}
                        onChange={(e) => setFormTerm({ ...formTerm, term: e.target.value })}
                        placeholder="e.g. Nova Brew"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="add-term-type" className="block text-xs font-semibold text-slate-700 mb-1">
                        Term Type *
                      </label>
                      <select
                        id="add-term-type"
                        value={formTerm.type}
                        onChange={(e) => setFormTerm({ ...formTerm, type: e.target.value as any })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 outline-none"
                      >
                        <option value="banned">Banned</option>
                        <option value="preferred">Preferred</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="add-term-replacement" className="block text-xs font-semibold text-slate-700 mb-1">
                        Replacement / Suggested Alternative
                      </label>
                      <input
                        id="add-term-replacement"
                        type="text"
                        value={formTerm.replacement}
                        onChange={(e) => setFormTerm({ ...formTerm, replacement: e.target.value })}
                        placeholder="e.g. NovaBrew"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="add-term-rule" className="block text-xs font-semibold text-slate-700 mb-1">
                        Governing Rule ID (optional)
                      </label>
                      <input
                        id="add-term-rule"
                        type="text"
                        value={formTerm.rule_id}
                        onChange={(e) => setFormTerm({ ...formTerm, rule_id: e.target.value })}
                        placeholder="e.g. R-TERM-01"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        id="add-term-approved"
                        type="checkbox"
                        checked={formTerm.approved}
                        onChange={(e) => setFormTerm({ ...formTerm, approved: e.target.checked })}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <label htmlFor="add-term-approved" className="text-xs font-medium text-slate-700">
                        Mark as Approved immediately
                      </label>
                    </div>
                  </>
                )}

                <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-xs transition disabled:opacity-50"
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
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200/90 rounded-xl max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900">
                  Edit {editingItem.entity === "rule" ? "Rule" : editingItem.entity === "fact" ? "Fact" : "Term"}
                </h2>
                <button
                  onClick={() => setEditingItem(null)}
                  className="text-slate-400 hover:text-slate-700 text-xl font-bold leading-none"
                >
                  &times;
                </button>
              </div>

              {formError && (
                <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {formError}
                </div>
              )}

              <form onSubmit={handleUpdateItem} className="mt-4 space-y-4">
                {editingItem.entity === "rule" && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Rule ID</label>
                      <input
                        type="text"
                        disabled
                        value={editingItem.data.id}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 font-mono text-slate-500 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-rule-category" className="block text-xs font-semibold text-slate-700 mb-1">
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
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 outline-none"
                      >
                        <option value="tone">Tone</option>
                        <option value="terminology">Terminology</option>
                        <option value="claims">Claims</option>
                        <option value="accessibility">Accessibility</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="edit-rule-severity" className="block text-xs font-semibold text-slate-700 mb-1">
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
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 outline-none"
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="edit-rule-text" className="block text-xs font-semibold text-slate-700 mb-1">
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
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 outline-none"
                      />
                    </div>
                  </>
                )}

                {editingItem.entity === "fact" && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Fact ID</label>
                      <input
                        type="text"
                        disabled
                        value={editingItem.data.id}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 font-mono text-slate-500 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-fact-statement" className="block text-xs font-semibold text-slate-700 mb-1">
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
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-fact-source" className="block text-xs font-semibold text-slate-700 mb-1">
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
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-fact-expiry" className="block text-xs font-semibold text-slate-700 mb-1">
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
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 outline-none"
                      />
                    </div>
                  </>
                )}

                {editingItem.entity === "term" && (
                  <>
                    <div>
                      <label htmlFor="edit-term-word" className="block text-xs font-semibold text-slate-700 mb-1">
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
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-term-type" className="block text-xs font-semibold text-slate-700 mb-1">
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
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 outline-none"
                      >
                        <option value="banned">Banned</option>
                        <option value="preferred">Preferred</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="edit-term-replacement" className="block text-xs font-semibold text-slate-700 mb-1">
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
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-term-rule" className="block text-xs font-semibold text-slate-700 mb-1">
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
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 outline-none"
                      />
                    </div>
                  </>
                )}

                <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingItem(null)}
                    className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-xs transition disabled:opacity-50"
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
