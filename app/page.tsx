import Link from "next/link";
import Navbar from "@/components/Navbar";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar />

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 flex flex-col items-center text-center">
        {/* Subtle pill badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80 mb-6 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
          <span>Enterprise Brand Governance & Citation-Backed Copy Review</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 max-w-4xl leading-tight">
          Verify marketing copy with{" "}
          <span className="text-indigo-600">grounded citations</span>.
        </h1>

        <p className="mt-5 text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
          BrandCite evaluates marketing drafts against approved brand rules, verifies claims with expiry tracking, flags terminology violations, and highlights ambiguous guidelines without hallucinating citations.
        </p>

        {/* CTA Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto">
          <Link
            href="/drafts"
            className="w-full sm:w-auto px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-sm transition-colors text-center"
          >
            Launch Drafts Workspace
          </Link>
          <Link
            href="/approvals"
            className="w-full sm:w-auto px-6 py-3 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 font-semibold text-sm text-slate-700 shadow-2xs transition-colors text-center"
          >
            Manager Approval Queue
          </Link>
          <Link
            href="/insights"
            className="w-full sm:w-auto px-6 py-3 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 font-semibold text-sm text-slate-700 shadow-2xs transition-colors text-center"
          >
            Guideline Insights
          </Link>
        </div>

        {/* Core Value Pillars Grid */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-left w-full">
          <div className="p-6 bg-white border border-slate-200/90 rounded-xl shadow-xs">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center font-bold text-base mb-4">
              ✓
            </div>
            <h2 className="text-base font-bold text-slate-900 mb-2">
              Exact & Rule-Based Checks
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Catches banned terms, enforces preferred roast vocabulary, checks length constraints, and flags absolute superlatives with exact database rule IDs.
            </p>
          </div>

          <div className="p-6 bg-white border border-slate-200/90 rounded-xl shadow-xs">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center font-bold text-base mb-4">
              📅
            </div>
            <h2 className="text-base font-bold text-slate-900 mb-2">
              Fact & Expiration Verifier
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Cross-references claims against verified facts. Automatically flags assertions supported only by expired certificates or outdated sourcing claims.
            </p>
          </div>

          <div className="p-6 bg-white border border-slate-200/90 rounded-xl shadow-xs">
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-700 border border-purple-100 flex items-center justify-center font-bold text-base mb-4">
              📊
            </div>
            <h2 className="text-base font-bold text-slate-900 mb-2">
              Guideline Gap Analytics
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Monitors creator decisions. Rules flagged repeatedly and frequently rejected are surfaced as possibly unclear to brand managers with action notes.
            </p>
          </div>
        </div>

        {/* Quick Demo Accounts Card */}
        <div className="mt-14 w-full max-w-2xl bg-white border border-slate-200/90 rounded-xl p-6 text-left shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Quick Demo Accounts (Password: <code className="text-indigo-600 font-mono">DemoPassword123!</code>)
            </h3>
            <Link
              href="/login"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Sign In &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
              <span className="font-bold text-indigo-700 block mb-1">Creator</span>
              <code className="text-slate-700 block font-mono text-[11px] truncate">creator.demo@example.com</code>
              <span className="text-[11px] text-slate-500 mt-1 block">Drafting & self-review</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
              <span className="font-bold text-indigo-700 block mb-1">Manager</span>
              <code className="text-slate-700 block font-mono text-[11px] truncate">manager.demo@example.com</code>
              <span className="text-[11px] text-slate-500 mt-1 block">Approvals & escalation</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
              <span className="font-bold text-indigo-700 block mb-1">Admin</span>
              <code className="text-slate-700 block font-mono text-[11px] truncate">admin.demo@example.com</code>
              <span className="text-[11px] text-slate-500 mt-1 block">Knowledge governance</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 py-6 text-center text-xs text-slate-500 bg-white">
        <p>BrandCite &copy; 2026. Built with Next.js, Supabase, and Google Antigravity.</p>
      </footer>
    </div>
  );
}
