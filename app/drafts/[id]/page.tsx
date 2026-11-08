"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { getSourceInfo } from "@/lib/sources";
import { computeSimpleDiff, DiffSummary } from "@/lib/diff";
import Navbar from "@/components/Navbar";

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

interface CommentItem {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  parent_id: string | null;
}

interface Draft {
  id: string;
  title: string | null;
  status: "draft" | "in_review" | "changes_requested" | "approved" | string;
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
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [content, setContent] = useState("");
  const [initialContent, setInitialContent] = useState("");
  const [loading, setLoading] = useState(true);

  // Workflow & form states
  const [submittingForApproval, setSubmittingForApproval] = useState(false);
  const [approvingDraft, setApprovingDraft] = useState(false);
  const [managerNote, setManagerNote] = useState("");
  const [savingVersion, setSavingVersion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // View modes: highlighted draft, editor, version diff history, comments
  const [activeTab, setActiveTab] = useState<"highlighted" | "editor" | "diff" | "comments">("highlighted");
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);

  // Diff comparison selection
  const [diffBaseVersionNo, setDiffBaseVersionNo] = useState<number>(1);
  const [diffTargetVersionNo, setDiffTargetVersionNo] = useState<number>(1);

  // Comment submission state
  const [newCommentBody, setNewCommentBody] = useState("");
  const [replyParentId, setReplyParentId] = useState<string | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);

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
      const vers: DraftVersion[] = data.versions ?? [];
      setVersions(vers);

      // Default diff base to previous version, target to latest
      if (vers.length > 1) {
        setDiffBaseVersionNo(vers[vers.length - 2].version_no);
        setDiffTargetVersionNo(vers[vers.length - 1].version_no);
      } else if (vers.length === 1) {
        setDiffBaseVersionNo(vers[0].version_no);
        setDiffTargetVersionNo(vers[0].version_no);
      }

      // Current version content
      const currentVer =
        vers.find((v) => v.version_no === data.draft?.current_version) ||
        vers[vers.length - 1];

      const currentContent = currentVer?.content ?? "";
      setContent(currentContent);
      setInitialContent(currentContent);
      setFindings(data.findings ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch comments thread
  const fetchComments = async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/drafts/${id}/comments`, {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments ?? []);
      }
    } catch {
      // Non-blocking for comments
    }
  };

  useEffect(() => {
    fetchDraftData();
    fetchComments();
  }, [id]);

  // Submit draft for approval (creator action)
  const handleSubmitForApproval = async () => {
    if (!draft) return;
    setSubmittingForApproval(true);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/drafts/${draft.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `Failed to submit draft (${res.status})`);
      }

      setDraft((prev) => (prev ? { ...prev, status: "in_review" } : null));
      setActionMessage("Draft successfully submitted for approval! Status changed to 'In Review'.");
    } catch (err) {
      alert(`Error submitting for approval: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setSubmittingForApproval(false);
    }
  };

  // Manager Approval Decision
  const handleManagerDecision = async (decision: "approved" | "changes_requested") => {
    if (!draft) return;
    setApprovingDraft(true);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/drafts/${draft.id}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: managerNote }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `Failed to ${decision} draft`);
      }

      setDraft((prev) => (prev ? { ...prev, status: decision } : null));
      setActionMessage(
        decision === "approved"
          ? "Draft has been APPROVED."
          : "Changes requested from author."
      );
      setManagerNote("");
    } catch (err) {
      alert(`Error processing approval decision: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setApprovingDraft(false);
    }
  };

  // Handle Accept/Reject decision on a finding
  const handleFindingDecision = async (findingId: string, decision: "accepted" | "rejected") => {
    setActionMessage(null);
    try {
      let res = await fetch(`/api/findings/${findingId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });

      // If that route is not allowed or failed because it's a manager resolving needs_human
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

      await fetchDraftData();
      setActionMessage("Saved new version and completed automated review!");
    } catch (err) {
      alert(`Error saving version: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setSavingVersion(false);
    }
  };

  // Post a new comment
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft || !newCommentBody.trim()) return;

    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/drafts/${draft.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: newCommentBody.trim(),
          parentId: replyParentId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to post comment");
      }

      setNewCommentBody("");
      setReplyParentId(null);
      await fetchComments();
      setActionMessage("Comment posted successfully.");
    } catch (err) {
      alert(`Error posting comment: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setSubmittingComment(false);
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

  // Compute version diff between selected versions
  const diffResult: DiffSummary = useMemo(() => {
    const base = versions.find((v) => v.version_no === diffBaseVersionNo)?.content ?? "";
    const target = versions.find((v) => v.version_no === diffTargetVersionNo)?.content ?? "";
    return computeSimpleDiff(base, target);
  }, [versions, diffBaseVersionNo, diffTargetVersionNo]);

  // Highlight matches in draft content
  const renderedHighlightedDraft = useMemo(() => {
    if (!content) return <span className="text-slate-400 italic">No content</span>;

    const activeFindings = findings.filter(
      (f) => f.quote && f.quote.trim().length > 0 && content.includes(f.quote)
    );

    if (activeFindings.length === 0) {
      return <span>{content}</span>;
    }

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

    segments.sort((a, b) => a.start - b.start);

    const elements: React.ReactNode[] = [];
    let cursor = 0;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.start < cursor) continue;

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
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <Navbar breadcrumb="Loading Draft..." />
        <div className="flex-1 flex items-center justify-center p-8">
          <div role="status" className="bg-white rounded-xl border border-slate-200/90 p-8 text-center max-w-sm w-full shadow-xs">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h2 className="text-slate-800 font-semibold text-base mb-1">Loading Draft</h2>
            <p className="text-slate-500 text-xs">Fetching copy, versions, comments, and review findings...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (error || !draft) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <Navbar breadcrumb="Error" />
        <div className="flex-1 flex items-center justify-center p-8">
          <div role="alert" className="bg-white rounded-xl border border-rose-200 p-8 text-center max-w-md w-full shadow-xs">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-lg mx-auto mb-3">
              !
            </div>
            <h2 className="text-slate-900 font-bold text-base mb-2">Error Loading Draft</h2>
            <p className="text-rose-700 text-xs mb-6">{error || "Draft not found."}</p>
            <Link
              href="/drafts"
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shadow-xs"
            >
              &larr; Back to Drafts List
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isContentDirty = content !== initialContent;

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "in_review":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "changes_requested":
        return "bg-rose-100 text-rose-800 border-rose-300";
      default:
        return "bg-slate-100 text-slate-700 border-slate-300";
    }
  };

  const formatStatus = (status: string) => {
    return status.replace("_", " ").toUpperCase();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Header */}
      <Navbar breadcrumb={draft.title || "Untitled Draft"} />

      {/* Draft Status Workflow Bar */}
      <aside aria-label="Draft workflow status" className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-semibold uppercase text-slate-500">Draft Status:</span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase border ${getStatusBadgeStyle(
                draft.status
              )}`}
            >
              {formatStatus(draft.status)}
            </span>
            <span className="text-xs text-slate-500">
              Version <strong>v{draft.current_version}</strong> ({versions.length} total versions)
            </span>

            {draft.status === "in_review" && (
              <span className="text-xs text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded border border-amber-200">
                Awaiting Manager Decision
              </span>
            )}
            {draft.status === "changes_requested" && (
              <span className="text-xs text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded border border-rose-200">
                Changes Requested by Reviewer
              </span>
            )}
            {draft.status === "approved" && (
              <span className="text-xs text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                Approved for Publication
              </span>
            )}
          </div>

          {/* Workflow Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Submit for Approval button */}
            {["draft", "changes_requested"].includes(draft.status) && (
              <button
                type="button"
                disabled={submittingForApproval}
                onClick={handleSubmitForApproval}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm transition-colors disabled:opacity-60"
              >
                {submittingForApproval ? "Submitting..." : "Submit for Approval &rarr;"}
              </button>
            )}

            {/* Manager Decisions (shown when in_review) */}
            {draft.status === "in_review" && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={managerNote}
                  onChange={(e) => setManagerNote(e.target.value)}
                  placeholder="Optional review note..."
                  className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg w-44 placeholder:text-slate-400 focus:ring-1 focus:ring-indigo-600"
                />
                <button
                  type="button"
                  disabled={approvingDraft}
                  onClick={() => handleManagerDecision("approved")}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-xs disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={approvingDraft}
                  onClick={() => handleManagerDecision("changes_requested")}
                  className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-semibold text-xs transition-colors disabled:opacity-60"
                >
                  Request Changes
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

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
          className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-center text-emerald-800 text-xs sm:text-sm font-medium flex items-center justify-center gap-2"
        >
          <span>{actionMessage}</span>
          <button
            onClick={() => setActionMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-2"
          >
            &times;
          </button>
        </aside>
      )}

      {/* Main Two-Column Layout */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex-1 flex flex-col lg:flex-row gap-6">
        {/* LEFT COLUMN: Editor, Highlighted Review, Version Diff History & Comments */}
        <section
          aria-label="Draft content and views"
          className="w-full lg:w-7/12 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
        >
          {/* Sub Navigation Tabs */}
          <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
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
              <button
                type="button"
                onClick={() => setActiveTab("diff")}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                  activeTab === "diff"
                    ? "bg-white text-indigo-700 shadow-sm border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Version Diff ({versions.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("comments")}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                  activeTab === "comments"
                    ? "bg-white text-indigo-700 shadow-sm border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Comments ({comments.length})
              </button>
            </div>

            {isContentDirty && activeTab === "editor" && (
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

          <div className="p-5 flex-1 flex flex-col min-h-[500px]">
            {/* VIEW 1: HIGHLIGHTED REVIEW */}
            {activeTab === "highlighted" && (
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
            )}

            {/* VIEW 2: TEXT EDITOR */}
            {activeTab === "editor" && (
              <div className="flex-1 flex flex-col">
                <label
                  htmlFor="draft-editor-textarea"
                  className="block text-xs font-semibold text-slate-600 mb-1.5"
                >
                  Edit Copy (saving will create version v{draft.current_version + 1} and re-run analysis):
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

            {/* VIEW 3: VERSION HISTORY & DIFF */}
            {activeTab === "diff" && (
              <div className="flex-1 flex flex-col">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700">Compare Base:</span>
                    <select
                      value={diffBaseVersionNo}
                      onChange={(e) => setDiffBaseVersionNo(Number(e.target.value))}
                      className="px-2 py-1 bg-white border border-slate-300 rounded font-medium"
                    >
                      {versions.map((v) => (
                        <option key={`base-v-${v.version_no}`} value={v.version_no}>
                          v{v.version_no} ({new Date(v.created_at).toLocaleTimeString()})
                        </option>
                      ))}
                    </select>

                    <span className="text-slate-400 font-bold">&rarr;</span>

                    <span className="font-semibold text-slate-700">Target:</span>
                    <select
                      value={diffTargetVersionNo}
                      onChange={(e) => setDiffTargetVersionNo(Number(e.target.value))}
                      className="px-2 py-1 bg-white border border-slate-300 rounded font-medium"
                    >
                      {versions.map((v) => (
                        <option key={`target-v-${v.version_no}`} value={v.version_no}>
                          v{v.version_no} ({new Date(v.created_at).toLocaleTimeString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                      +{diffResult.addedCount} added
                    </span>
                    <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                      -{diffResult.removedCount} removed
                    </span>
                  </div>
                </div>

                <div className="flex-1 p-4 rounded-lg bg-slate-50 border border-slate-200 font-mono text-sm leading-relaxed whitespace-pre-wrap text-slate-900 overflow-y-auto max-h-[460px]">
                  {diffResult.tokens.map((token, idx) => {
                    if (token.type === "added") {
                      return (
                        <ins
                          key={`diff-token-${idx}`}
                          className="bg-emerald-100 text-emerald-900 border-b-2 border-emerald-500 px-0.5 rounded no-underline font-semibold"
                        >
                          {token.value}
                        </ins>
                      );
                    }
                    if (token.type === "removed") {
                      return (
                        <del
                          key={`diff-token-${idx}`}
                          className="bg-rose-100 text-rose-900 line-through border-b-2 border-rose-400 px-0.5 rounded opacity-80"
                        >
                          {token.value}
                        </del>
                      );
                    }
                    return <span key={`diff-token-${idx}`}>{token.value}</span>;
                  })}
                </div>
              </div>
            )}

            {/* VIEW 4: COMMENTS THREAD */}
            {activeTab === "comments" && (
              <div className="flex-1 flex flex-col">
                <div className="flex-1 overflow-y-auto space-y-3 mb-4 max-h-[360px] pr-1">
                  {comments.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-xs">
                      No comments yet on this draft. Start the discussion below.
                    </div>
                  ) : (
                    comments.map((c) => (
                      <div
                        key={c.id}
                        className={`p-3.5 rounded-lg border text-xs ${
                          c.parent_id
                            ? "ml-6 bg-slate-50 border-slate-200"
                            : "bg-white border-slate-200 shadow-2xs"
                        }`}
                      >
                        <div className="flex items-center justify-between text-slate-500 mb-1">
                          <span className="font-semibold text-slate-800">
                            User {c.author_id.slice(0, 8)}...
                          </span>
                          <span>{new Date(c.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-800 text-sm whitespace-pre-wrap">{c.body}</p>
                        {!c.parent_id && (
                          <div className="mt-2 text-right">
                            <button
                              type="button"
                              onClick={() => setReplyParentId(c.id)}
                              className="text-indigo-600 hover:underline font-medium text-xs"
                            >
                              Reply
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Add Comment Form */}
                <form onSubmit={handlePostComment} className="pt-3 border-t border-slate-200">
                  {replyParentId && (
                    <div className="flex items-center justify-between text-xs text-indigo-700 bg-indigo-50 p-2 rounded mb-2">
                      <span>Replying to comment #{replyParentId.slice(0, 6)}</span>
                      <button
                        type="button"
                        onClick={() => setReplyParentId(null)}
                        className="font-bold"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  <label htmlFor="comment-input" className="block text-xs font-semibold text-slate-700 mb-1">
                    Add review comment:
                  </label>
                  <textarea
                    id="comment-input"
                    rows={3}
                    value={newCommentBody}
                    onChange={(e) => setNewCommentBody(e.target.value)}
                    placeholder="Write a comment or revision note..."
                    className="w-full p-2.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 mb-2"
                  />
                  <div className="text-right">
                    <button
                      type="submit"
                      disabled={submittingComment || !newCommentBody.trim()}
                      className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm transition-colors disabled:opacity-50"
                    >
                      {submittingComment ? "Posting..." : "Post Comment"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          <footer className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>
              v{draft.current_version} &bull; {content.length} characters
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
                          onClick={() => handleFindingDecision(f.id, "accepted")}
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
                          onClick={() => handleFindingDecision(f.id, "rejected")}
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
