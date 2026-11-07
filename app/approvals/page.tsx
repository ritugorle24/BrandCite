"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSourceInfo } from "@/lib/sources";

interface DraftInReview {
  id: string;
  title: string | null;
  status: string;
  current_version: number;
  created_at: string;
}

interface NeedsHumanFinding {
  id: string;
  draft_id: string;
  draft_title: string | null;
  version_no: number;
  source_id: string | null;
  issue: string;
  quote: string | null;
  severity: string;
  suggestion: string | null;
  confidence: number;
  escalation_reason: string | null;
  ai_assisted: boolean;
  created_at?: string;
}

export default function ApprovalsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"approvals" | "queue">("approvals");

  // Approval queue state
  const [drafts, setDrafts] = useState<DraftInReview[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(true);
  const [draftsError, setDraftsError] = useState<string | null>(null);

  // Review queue (needs human) state
  const [reviewQueue, setReviewQueue] = useState<NeedsHumanFinding[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);

  // Actions state
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Fetch drafts awaiting approval
  const fetchDraftsInReview = async () => {
    setLoadingDrafts(true);
    setDraftsError(null);
    try {
      const res = await fetch("/api/drafts?status=in_review", {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      if (!res.ok) {
        if (res.status === 401) {
          router.replace("/login?redirect=/approvals");
          return;
        }
        if (res.status === 403) {
          throw new Error("Access restricted to managers and administrators.");
        }
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP Error ${res.status}`);
      }

      const data = await res.json();
      setDrafts(data.drafts ?? []);
    } catch (err) {
      setDraftsError(err instanceof Error ? err.message : "Failed to load approval queue.");
    } finally {
      setLoadingDrafts(false);
    }
  };

  // Fetch needs-human review queue
  const fetchReviewQueue = async () => {
    setLoadingQueue(true);
    setQueueError(null);
    try {
      const res = await fetch("/api/review-queue", {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      if (!res.ok) {
        if (res.status === 401) {
          router.replace("/login?redirect=/approvals");
          return;
        }
        if (res.status === 403) {
          throw new Error("Access restricted to managers and administrators.");
        }
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP Error ${res.status}`);
      }

      const data = await res.json();
      setReviewQueue(data.queue ?? []);
    } catch (err) {
      setQueueError(err instanceof Error ? err.message : "Failed to load review queue.");
    } finally {
      setLoadingQueue(false);
    }
  };

  useEffect(() => {
    fetchDraftsInReview();
    fetchReviewQueue();
  }, []);

  // Handle draft approval / changes_requested
  const handleDraftApproval = async (
    draftId: string,
    decision: "approved" | "changes_requested"
  ) => {
    setActionLoading(`draft-${draftId}`);
    setStatusMessage(null);

    const note = approvalNotes[draftId]?.trim() || "";

    try {
      const res = await fetch(`/api/drafts/${draftId}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `Failed to ${decision} draft`);
      }

      // Remove from list
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
      setStatusMessage(
        decision === "approved"
          ? "Draft approved successfully."
          : "Changes requested from author."
      );
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Action failed"}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle resolving a needs-human finding
  const handleResolveFinding = async (
    findingId: string,
    decision: "confirmed" | "dismissed"
  ) => {
    setActionLoading(`finding-${findingId}`);
    setStatusMessage(null);

    try {
      const res = await fetch(`/api/findings/${findingId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: "" }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `Failed to ${decision} finding`);
      }

      // Remove from review queue
      setReviewQueue((prev) => prev.filter((f) => f.id !== findingId));
      setStatusMessage(
        decision === "confirmed"
          ? "Finding confirmed and sent to author."
          : "Finding dismissed as false positive."
      );
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Resolution failed"}`);
    } finally {
      setActionLoading(null);
    }
  };

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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
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
            <span className="text-sm font-semibold text-slate-700">Manager Dashboard</span>
          </div>

          <nav aria-label="Main Navigation" className="flex items-center gap-3">
            <Link
              href="/drafts"
              className="px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium text-sm transition-colors"
            >
              Drafts
            </Link>
            <Link
              href="/insights"
              className="px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium text-sm transition-colors"
            >
              Insights
            </Link>
            <Link
              href="/admin/knowledge"
              className="px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium text-sm transition-colors"
            >
              Knowledge
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
      <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 flex-1">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Manager Approval Hub</h1>
          <p className="text-sm text-slate-500 mt-1">
            Sign off on pending draft submissions and triage escalated findings requiring human review.
          </p>
        </div>

        {/* Status notification toast */}
        {statusMessage && (
          <aside
            role="status"
            aria-live="polite"
            className="mb-6 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center justify-between"
          >
            <span>{statusMessage}</span>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-emerald-700 hover:text-emerald-900 font-bold text-base ml-2"
              aria-label="Dismiss message"
            >
              &times;
            </button>
          </aside>
        )}

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 mb-6 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("approvals")}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "approvals"
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <span>Draft Approvals</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === "approvals"
                  ? "bg-indigo-100 text-indigo-800"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {drafts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("queue")}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "queue"
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <span>Needs-Human Review Queue</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === "queue"
                  ? "bg-purple-100 text-purple-800"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {reviewQueue.length}
            </span>
          </button>
        </div>

        {/* TAB 1: DRAFT APPROVALS */}
        {activeTab === "approvals" && (
          <section aria-label="Drafts awaiting approval">
            {loadingDrafts && (
              <div role="status" className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
                <div className="inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p className="text-slate-600 font-medium text-sm">Loading drafts awaiting approval...</p>
              </div>
            )}

            {!loadingDrafts && draftsError && (
              <div role="alert" className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center text-rose-800 shadow-sm">
                <p className="font-semibold text-base mb-1">Approval Queue Error</p>
                <p className="text-sm text-rose-700 mb-4">{draftsError}</p>
                <button
                  onClick={fetchDraftsInReview}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Retry
                </button>
              </div>
            )}

            {!loadingDrafts && !draftsError && drafts.length === 0 && (
              <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 font-bold text-xl">
                  ✓
                </div>
                <h2 className="text-lg font-semibold text-slate-800 mb-1">Queue is clear</h2>
                <p className="text-sm text-slate-500 max-w-sm mx-auto">
                  There are currently no drafts awaiting approval. All submitted copy has been reviewed.
                </p>
              </div>
            )}

            {!loadingDrafts && !draftsError && drafts.length > 0 && (
              <div className="space-y-4">
                {drafts.map((d) => {
                  const dateStr = new Date(d.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const isBusy = actionLoading === `draft-${d.id}`;

                  return (
                    <article
                      key={d.id}
                      className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:border-slate-300 transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                        <div>
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <h2 className="text-lg font-bold text-slate-900">
                              {d.title || "Untitled Draft"}
                            </h2>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300">
                              Awaiting Approval
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            Version {d.current_version} &bull; Submitted {dateStr}
                          </p>
                        </div>

                        <Link
                          href={`/drafts/${d.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors shrink-0"
                        >
                          <span>Open Full Draft</span>
                          <span aria-hidden="true">&rarr;</span>
                        </Link>
                      </div>

                      {/* Optional Reviewer Note */}
                      <div className="mb-4">
                        <label
                          htmlFor={`note-${d.id}`}
                          className="block text-xs font-semibold text-slate-700 mb-1"
                        >
                          Reviewer Feedback Note (Optional):
                        </label>
                        <input
                          id={`note-${d.id}`}
                          type="text"
                          value={approvalNotes[d.id] || ""}
                          onChange={(e) =>
                            setApprovalNotes((prev) => ({
                              ...prev,
                              [d.id]: e.target.value,
                            }))
                          }
                          placeholder="e.g. Looks good, approved for Summer campaign or Please adjust superlatives in paragraph 2"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                        />
                      </div>

                      {/* Approval Actions */}
                      <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDraftApproval(d.id, "approved")}
                          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-sm transition-colors disabled:opacity-60"
                        >
                          {isBusy ? "Processing..." : "✓ Approve Draft"}
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDraftApproval(d.id, "changes_requested")}
                          className="px-4 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-medium text-xs transition-colors disabled:opacity-60"
                        >
                          {isBusy ? "Processing..." : "✕ Request Changes"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* TAB 2: NEEDS-HUMAN REVIEW QUEUE */}
        {activeTab === "queue" && (
          <section aria-label="Escalated findings review queue">
            {loadingQueue && (
              <div role="status" className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
                <div className="inline-block w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p className="text-slate-600 font-medium text-sm">Loading escalated review items...</p>
              </div>
            )}

            {!loadingQueue && queueError && (
              <div role="alert" className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center text-rose-800 shadow-sm">
                <p className="font-semibold text-base mb-1">Review Queue Error</p>
                <p className="text-sm text-rose-700 mb-4">{queueError}</p>
                <button
                  onClick={fetchReviewQueue}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Retry
                </button>
              </div>
            )}

            {!loadingQueue && !queueError && reviewQueue.length === 0 && (
              <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-4 font-bold text-xl">
                  ✓
                </div>
                <h2 className="text-lg font-semibold text-slate-800 mb-1">No escalated items</h2>
                <p className="text-sm text-slate-500 max-w-sm mx-auto">
                  All low-confidence or ungrounded findings have been reviewed and resolved.
                </p>
              </div>
            )}

            {!loadingQueue && !queueError && reviewQueue.length > 0 && (
              <div className="space-y-4">
                {reviewQueue.map((f) => {
                  const source = getSourceInfo(f.source_id);
                  const isBusy = actionLoading === `finding-${f.id}`;

                  return (
                    <article
                      key={f.id}
                      className="bg-white rounded-xl border-2 border-purple-300 p-6 shadow-sm hover:shadow-md transition-all"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase bg-purple-600 text-white">
                            Needs Human Review
                          </span>
                          <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-rose-100 text-rose-800 border border-rose-300">
                            {f.severity || "MEDIUM"}
                          </span>
                          {f.ai_assisted && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                              AI-assisted
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-500">
                            Confidence: {Math.round((f.confidence ?? 0) * 100)}%
                          </span>
                          <Link
                            href={`/drafts/${f.draft_id}`}
                            className="font-semibold text-indigo-600 hover:underline"
                          >
                            Draft: {f.draft_title || "View Draft"} &rarr;
                          </Link>
                        </div>
                      </div>

                      {/* Escalation Reason */}
                      {f.escalation_reason && (
                        <div className="mb-3 p-2 rounded-lg bg-purple-100/70 text-purple-900 text-xs font-medium">
                          <strong>Escalation Reason:</strong> {f.escalation_reason}
                        </div>
                      )}

                      {/* Quoted Text */}
                      {f.quote && (
                        <blockquote className="my-2 p-2.5 rounded bg-amber-50 border-l-4 border-amber-400 font-mono text-xs text-slate-800">
                          &ldquo;{f.quote}&rdquo;
                        </blockquote>
                      )}

                      {/* Issue */}
                      <p className="text-sm font-semibold text-slate-900 mb-2">
                        <span className="text-slate-500 font-normal">Issue: </span>
                        {f.issue}
                      </p>

                      {/* Cited Source */}
                      {f.source_id && (
                        <div className="my-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                          <div className="font-bold text-slate-800 mb-0.5">
                            Cited Source: {f.source_id}
                          </div>
                          <p className="text-slate-600 leading-relaxed">
                            {source?.text || `Brand specification ${f.source_id}`}
                          </p>
                        </div>
                      )}

                      {/* Suggestion */}
                      {f.suggestion && (
                        <div className="my-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                          <strong>Suggestion: </strong>
                          <span>{f.suggestion}</span>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-400">
                          Confirm to forward to author as an open issue, or dismiss if it is a false positive.
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleResolveFinding(f.id, "confirmed")}
                            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition-colors disabled:opacity-60"
                          >
                            {isBusy ? "Saving..." : "Confirm Issue"}
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleResolveFinding(f.id, "dismissed")}
                            className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-semibold text-xs transition-colors disabled:opacity-60"
                          >
                            {isBusy ? "Saving..." : "Dismiss"}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

