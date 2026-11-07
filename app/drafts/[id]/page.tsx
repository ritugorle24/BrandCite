"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { getSourceInfo } from "@/lib/sources";

interface Finding {
  id: string;
  draft_id: string;
  version_no: number;
  source_id: string | null;
  issue: string;
  quote: string | null;
  severity: "low" | "medium" | "high" | string;
  suggestion: string | null;
  confidence: number;
  status: "open" | "accepted" | "rejected" | "needs_human" | string;
  ai_assisted: boolean;
  escalation_reason?: string | null;
  created_at?: string;
}

interface DraftVersion {
  version_no: number;
  content: string;
  created_at: string;
}

interface Draft {
  id: string;
  title: string | null;
  status: string;
  current_version: number;
  author_id: string;
  created_at: string;
}

export default function DraftDetailPage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };

  const [draft, setDraft] = useState<Draft | null>(null);
  const [versions, setVersions] = useState<DraftVersion[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [content, setContent] = useState("");
  const [initialContent, setInitialContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingVersion, setSavingVersion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"highlighted" | "editor">("highlighted");

  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Fetch draft data on mount / when id changes
  const fetchDraftData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/drafts/${id}`, {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      if (!res.ok) {
        if (res.status === 401) {
          router.replace(`/login?redirect=/drafts/${id}`);
          return;
        }
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to fetch draft (HTTP ${res.status})`);
      }

      const data = await res.json();
      setDraft(data.draft);
      setVersions(data.versions ?? []);

      // Current version content
      const currentVer =
        (data.versions ?? []).find(
          (v: DraftVersion) => v.version_no === data.draft?.current_version
        ) || data.versions?.[data.versions.length - 1];

      const currentContent = currentVer?.content ?? "";
      setContent(currentContent);
      setInitialContent(currentContent);
      setFindings(data.findings ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDraftData();
  }, [id]);

  // Handle Accept/Reject decision on a finding
  const handleDecision = async (findingId: string, decision: "accepted" | "rejected") => {
    setActionMessage(null);
    try {
      // First try /api/findings/:id/decision
      let res = await fetch(`/api/findings/${findingId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });

      // If that route is not allowed or failed because it's a manager resolve
      if (!res.ok && res.status === 403) {
        const resolveDecision = decision === "accepted" ? "confirmed" : "dismissed";
        res = await fetch(`/api/findings/${findingId}/resolve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision: resolveDecision, note: "" }),
        });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Action failed with status ${res.status}`);
      }

      // Update local state
      setFindings((prev) =>
        prev.map((f) => (f.id === findingId ? { ...f, status: decision } : f))
      );

      setActionMessage(
        decision === "accepted"
          ? "Finding marked as accepted."
          : "Finding marked as rejected."
      );
    } catch (err) {
      alert(`Error updating decision: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  // Quick edit: replace finding quote with suggestion in the content editor
  const handleApplySuggestion = (f: Finding) => {
    if (!f.quote || !f.suggestion) return;
    if (!content.includes(f.quote)) {
      alert(`Quote "${f.quote}" was not found in the current text.`);
      return;
    }
    const updated = content.replace(f.quote, f.suggestion);
    setContent(updated);
    setActiveTab("editor");
    setActionMessage(`Applied suggestion: "${f.suggestion}"`);
  };

  // Focus and select quote in the editor
  const handleEditFinding = (f: Finding) => {
    setActiveTab("editor");
    setSelectedFindingId(f.id);

    setTimeout(() => {
      if (editorRef.current && f.quote) {
        const index = content.indexOf(f.quote);
        if (index !== -1) {
          editorRef.current.focus();
          editorRef.current.setSelectionRange(index, index + f.quote.length);
        } else {
          editorRef.current.focus();
        }
      }
    }, 100);
  };

  // Save modified content as a new version
  const handleSaveNewVersion = async () => {
    if (!draft) return;
    if (!content.trim()) {
      alert("Draft content cannot be empty.");
      return;
    }

    setSavingVersion(true);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/drafts/${draft.id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to save new version (HTTP ${res.status})`);
      }

      // Refresh draft data
      await fetchDraftData();
      setActionMessage("Saved new version and completed automated review!");
    } catch (err) {
      alert(`Error saving version: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setSavingVersion(false);
    }
  };

  // Identify rules-only notice
  const rulesOnlyNotice = useMemo(() => {
    return findings.find(
      (f) =>
        f.issue?.includes("AI review unavailable") ||
        f.issue?.includes("rules-only results")
    );
  }, [findings]);

  // Highlight matches in draft content
  const renderedHighlightedDraft = useMemo(() => {
    if (!content) return <span className="text-slate-400 italic">No content</span>;

    // Filter findings that have quotes
    const activeFindings = findings.filter(
      (f) => f.quote && f.quote.trim().length > 0 && content.includes(f.quote)
    );

    if (activeFindings.length === 0) {
      return <span>{content}</span>;
    }

    // Build segments
    interface Segment {
      start: number;
      end: number;
      finding: Finding;
    }

    const segments: Segment[] = [];

    activeFindings.forEach((f) => {
      const quote = f.quote!;
      let startIdx = content.indexOf(quote);
      while (startIdx !== -1) {
        segments.push({
          start: startIdx,
          end: startIdx + quote.length,
          finding: f,
        });
        startIdx = content.indexOf(quote, startIdx + quote.length);
      }
    });

    // Sort segments by start index
    segments.sort((a, b) => a.start - b.start);

    // Non-overlapping segments
    const elements: React.ReactNode[] = [];
    let cursor = 0;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.start < cursor) continue; // Skip overlaps for simplicity

      // Text before mark
      if (seg.start > cursor) {
        elements.push(content.slice(cursor, seg.start));
      }

      const isSelected = selectedFindingId === seg.finding.id;
      const isNeedsHuman = seg.finding.status === "needs_human";

      elements.push(
        <mark
          key={`mark-${seg.finding.id}-${seg.start}`}
          onClick={() => {
            setSelectedFindingId(seg.finding.id);
            const card = document.getElementById(`finding-card-${seg.finding.id}`);
            if (card) {
              card.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
          }}
          className={`${
            isNeedsHuman
              ? "finding-highlight-needs-human"
              : "finding-highlight"
          } ${isSelected ? "active" : ""}`}
          title={`Click to inspect issue: ${seg.finding.issue}`}
        >
          {content.slice(seg.start, seg.end)}
        </mark>
      );

      cursor = seg.end;
    }

    if (cursor < content.length) {
      elements.push(content.slice(cursor));
    }

    return elements;
  }, [content, findings, selectedFindingId]);

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div
          role="status"
          className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-sm w-full shadow-sm"
        >
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-slate-800 font-semibold text-base mb-1">Loading Draft</h2>
          <p className="text-slate-500 text-sm">Fetching draft copy, version history and review findings...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error || !draft) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div
          role="alert"
          className="bg-white rounded-xl border border-rose-200 p-8 text-center max-w-md w-full shadow-sm"
        >
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-xl mx-auto mb-3">
            !
          </div>
          <h2 className="text-slate-900 font-bold text-lg mb-2">Error Loading Draft</h2>
          <p className="text-rose-700 text-sm mb-6">{error || "Draft not found or you do not have permission to view it."}</p>
          <Link
            href="/drafts"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
          >
            &larr; Back to Drafts List
          </Link>
        </div>
      </div>
    );
  }

  const isContentDirty = content !== initialContent;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 min-h-16 py-2 sm:py-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="min-w-0 flex items-center gap-2 sm:gap-3">
            <Link
              href="/drafts"
              className="flex items-center gap-2 text-slate-900 font-bold text-base hover:text-indigo-600 transition-colors shrink-0"
            >
              <span className="w-7 h-7 rounded bg-indigo-600 flex items-center justify-center text-white text-xs">B</span>
              <span>BrandCite</span>
            </Link>
            <span className="text-slate-300 font-light" aria-hidden="true">/</span>
            <span className="text-sm font-semibold text-slate-800 truncate min-w-0 flex-1 max-w-[120px] sm:max-w-xs">
              {draft.title || "Untitled Draft"}
            </span>
            <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold uppercase bg-slate-100 text-slate-700 border border-slate-200">
              v{draft.current_version} &bull; {draft.status}
            </span>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <Link
              href="/drafts"
              className="text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 transition-colors"
            >
              &larr; All Drafts
            </Link>
            <Link
              href="/drafts/new"
              className="text-xs sm:text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition-colors shadow-sm"
            >
              + New Draft
            </Link>
          </div>
        </div>
      </header>

      {/* Rules-Only Notice Banner */}
      {rulesOnlyNotice && (
        <aside
          role="note"
          aria-label="Rules-only review notice"
          className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-2.5 text-amber-900 text-sm flex items-center justify-center gap-2"
        >
          <span aria-hidden="true" className="font-bold text-amber-600">ℹ</span>
          <span>
            <strong>Notice:</strong> AI review unavailable, rules-only results. Exact keyword and terminology checks were completed.
          </span>
        </aside>
      )}

      {/* Action Notification Toast */}
      {actionMessage && (
        <aside
          role="status"
          aria-live="polite"
          className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-center text-emerald-800 text-xs sm:text-sm font-medium"
        >
          {actionMessage}
        </aside>
      )}

      {/* Main Two-Column Layout */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex-1 flex flex-col lg:flex-row gap-6">
        {/* LEFT COLUMN: Text Editor & Highlighted Preview */}
        <section
          aria-label="Draft text editor and preview"
          className="w-full lg:w-7/12 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
        >
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("highlighted")}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                  activeTab === "highlighted"
                    ? "bg-white text-indigo-700 shadow-sm border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Highlighted Review
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("editor")}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                  activeTab === "editor"
                    ? "bg-white text-indigo-700 shadow-sm border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Text Editor {isContentDirty && <span className="text-amber-600">&bull;</span>}
              </button>
            </div>

            {isContentDirty && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setContent(initialContent)}
                  disabled={savingVersion}
                  className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleSaveNewVersion}
                  disabled={savingVersion}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-60"
                >
                  {savingVersion ? "Saving..." : "Save as v" + (draft.current_version + 1)}
                </button>
              </div>
            )}
          </div>

          <div className="p-5 flex-1 flex flex-col min-h-[460px]">
            {activeTab === "highlighted" ? (
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span>Click any highlighted segment to view its guideline finding:</span>
                  <button
                    onClick={() => setActiveTab("editor")}
                    className="text-indigo-600 hover:underline font-medium"
                  >
                    Edit Copy
                  </button>
                </div>
                <div
                  aria-label="Highlighted draft content"
                  tabIndex={0}
                  className="flex-1 p-4 rounded-lg bg-slate-50 border border-slate-200 font-mono text-sm leading-relaxed whitespace-pre-wrap text-slate-900 overflow-y-auto focus-visible:ring-2 focus-visible:ring-indigo-600"
                >
                  {renderedHighlightedDraft}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                <label
                  htmlFor="draft-editor-textarea"
                  className="block text-xs font-semibold text-slate-600 mb-1.5"
                >
                  Edit Copy (saving will create a new version and re-run brand analysis):
                </label>
                <textarea
                  id="draft-editor-textarea"
                  ref={editorRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={20}
                  className="w-full flex-1 p-4 rounded-lg border border-slate-300 font-mono text-sm leading-relaxed text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-colors resize-y min-h-[400px]"
                  placeholder="Draft content..."
                />
              </div>
            )}
          </div>

          <footer className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>
              Version {draft.current_version} of {versions.length} &bull; {content.length} characters
            </span>
            <span>NovaBrew Brand Governance</span>
          </footer>
        </section>

        {/* RIGHT COLUMN: Findings Panel */}
        <section
          aria-label="Findings panel"
          className="w-full lg:w-5/12 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
        >
          {/* Findings Header */}
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Findings ({findings.length})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Issues identified against brand guidelines
              </p>
            </div>

            {findings.some((f) => f.status === "needs_human") && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                Needs Human Review
              </span>
            )}
          </div>

          {/* Findings List Area */}
          <div className="p-4 flex-1 overflow-y-auto space-y-4 max-h-[700px]">
            {/* Empty Findings State */}
            {findings.length === 0 ? (
              <div
                role="status"
                className="p-10 text-center border border-dashed border-slate-200 rounded-xl"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg mx-auto mb-2">
                  ✓
                </div>
                <h3 className="text-sm font-semibold text-slate-800 mb-1">
                  Compliant Draft
                </h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  No issues flagged. This draft version satisfies all approved tone, terminology, claims, and accessibility rules.
                </p>
              </div>
            ) : (
              findings.map((f) => {
                const source = getSourceInfo(f.source_id);
                const isNeedsHuman = f.status === "needs_human";
                const isSelected = selectedFindingId === f.id;

                // Severity colors
                const severityLower = (f.severity || "medium").toLowerCase();
                let severityBadge = "bg-amber-100 text-amber-800 border-amber-300";
                if (severityLower === "high") {
                  severityBadge = "bg-rose-100 text-rose-800 border-rose-300";
                } else if (severityLower === "low" || severityLower === "info") {
                  severityBadge = "bg-blue-100 text-blue-800 border-blue-300";
                }

                return (
                  <article
                    key={f.id}
                    id={`finding-card-${f.id}`}
                    onClick={() => setSelectedFindingId(f.id)}
                    tabIndex={0}
                    className={`rounded-xl p-4 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                      isNeedsHuman
                        ? "bg-purple-50/60 border-2 border-purple-300 shadow-sm"
                        : "bg-white border border-slate-200 hover:border-slate-300 shadow-sm"
                    } ${isSelected ? "ring-2 ring-indigo-500" : ""}`}
                  >
                    {/* Card Badges Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase border ${severityBadge}`}
                        >
                          {f.severity || "MEDIUM"}
                        </span>

                        {isNeedsHuman && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-purple-600 text-white shadow-xs">
                            Needs Human Review
                          </span>
                        )}

                        {f.ai_assisted && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                            AI-assisted
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          Confidence: {Math.round((f.confidence ?? 1) * 100)}%
                        </span>
                        {f.status === "accepted" && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            Accepted
                          </span>
                        )}
                        {f.status === "rejected" && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800">
                            Rejected
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quoted Text */}
                    {f.quote && (
                      <blockquote className="my-2 p-2 rounded bg-amber-50/80 border-l-4 border-amber-400 font-mono text-xs text-slate-800 break-words">
                        &ldquo;{f.quote}&rdquo;
                      </blockquote>
                    )}

                    {/* The Reason / Issue */}
                    <p className="text-xs sm:text-sm font-semibold text-slate-900 mb-1.5">
                      <span className="text-slate-500 font-normal">Reason: </span>
                      {f.issue}
                    </p>

                    {/* Escalation reason if present */}
                    {f.escalation_reason && (
                      <p className="text-xs text-purple-800 bg-purple-100/70 p-1.5 rounded mb-2 font-medium">
                        <strong>Escalation:</strong> {f.escalation_reason}
                      </p>
                    )}

                    {/* Cited Source ID with Full Guideline Text */}
                    {f.source_id && (
                      <div className="my-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-800">
                            Cited Source: {f.source_id}
                          </span>
                          {source?.category && (
                            <span className="text-[10px] uppercase font-semibold text-slate-400">
                              {source.category}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-600 leading-relaxed">
                          {source?.text || `Brand rule or fact reference ${f.source_id}`}
                        </p>
                      </div>
                    )}

                    {/* Suggestion */}
                    {f.suggestion && (
                      <div className="my-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                        <span className="font-semibold text-emerald-800">Suggestion: </span>
                        <span>{f.suggestion}</span>
                      </div>
                    )}

                    {/* Action Buttons: Accept, Reject, Edit */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDecision(f.id, "accepted")}
                          className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                            f.status === "accepted"
                              ? "bg-emerald-700 text-white"
                              : "bg-emerald-600 hover:bg-emerald-700 text-white"
                          }`}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDecision(f.id, "rejected")}
                          className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                            f.status === "rejected"
                              ? "bg-rose-700 text-white"
                              : "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300"
                          }`}
                        >
                          Reject
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {f.suggestion && (
                          <button
                            type="button"
                            onClick={() => handleApplySuggestion(f)}
                            className="px-2.5 py-1 rounded text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                            title="Replace quote with suggestion in the editor"
                          >
                            Apply
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleEditFinding(f)}
                          className="px-2.5 py-1 rounded text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                          title="Focus editor on this quote"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          <footer className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 text-center">
            Decisions are recorded for governance analytics and compliance audits.
          </footer>
        </section>
      </main>
    </div>
  );
}
