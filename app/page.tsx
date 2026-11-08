import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans">
      {/* Navbar */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-amber-700 dark:bg-amber-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              B
            </span>
            <span className="text-xl font-bold tracking-tight text-amber-800 dark:text-amber-500">
              BrandCite
            </span>
            <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              NovaBrew Edition
            </span>
          </div>

          <nav className="flex items-center gap-3 sm:gap-6 text-sm font-medium">
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
            <Link
              href="/admin/knowledge"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition"
            >
              Knowledge
            </Link>
            <Link
              href="/login"
              className="px-3.5 py-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition shadow-sm"
            >
              Sign In
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 mb-8 shadow-sm">
          <span>✨</span>
          <span>Automated Compliance, Claim Verification & Guideline Analytics</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-zinc-950 dark:text-zinc-50 max-w-4xl leading-tight sm:leading-none">
          Brand governance copy review with{" "}
          <span className="text-amber-700 dark:text-amber-500">grounded citations</span>.
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl leading-relaxed">
          BrandCite evaluates marketing copy drafts against approved brand rules, verifies facts with expiry tracking, flags terminology violations, and highlights ambiguous guidelines without hallucinating citations.
        </p>

        {/* CTA Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <Link
            href="/drafts"
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-amber-700 hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500 text-white font-semibold text-sm shadow-md transition text-center"
          >
            Launch Drafts Workspace
          </Link>
          <Link
            href="/approvals"
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-semibold text-sm text-zinc-800 dark:text-zinc-200 shadow-sm transition text-center"
          >
            Manager Approval Queue
          </Link>
          <Link
            href="/insights"
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-semibold text-sm text-zinc-800 dark:text-zinc-200 transition text-center"
          >
            Guideline Insights
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 text-left w-full">
          <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold text-lg mb-4">
              ✓
            </div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">
              Exact & Contextual Checks
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Catches banned words, ensures preferred roast terminology, validates headline lengths, and flags corporate jargon with grounded source rule IDs.
            </p>
          </div>

          <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-lg mb-4">
              📅
            </div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">
              Fact & Expiration Verifier
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Cross-references claims against verified facts. Automatically flags assertions supported only by expired certificates or outdated sourcing claims.
            </p>
          </div>

          <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 flex items-center justify-center font-bold text-lg mb-4">
              📊
            </div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">
              Guideline Gap Analytics
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Monitors reviewer accept/reject decisions. Rules flagged $\ge 3$ times and rejected $\ge 50\%$ are surfaced as possibly unclear to brand managers.
            </p>
          </div>
        </div>

        {/* Demo Credentials Box */}
        <div className="mt-16 w-full max-w-2xl bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-left shadow-sm">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider mb-3">
            Quick Demo Accounts (Password: DemoPassword123!)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <span className="font-bold text-amber-700 dark:text-amber-400 block mb-1">Creator</span>
              <code className="text-zinc-700 dark:text-zinc-300">creator.demo@example.com</code>
            </div>
            <div className="p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <span className="font-bold text-blue-700 dark:text-blue-400 block mb-1">Manager</span>
              <code className="text-zinc-700 dark:text-zinc-300">manager.demo@example.com</code>
            </div>
            <div className="p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <span className="font-bold text-purple-700 dark:text-purple-400 block mb-1">Admin</span>
              <code className="text-zinc-700 dark:text-zinc-300">admin.demo@example.com</code>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-6 text-center text-xs text-zinc-500">
        <p>BrandCite &copy; 2026. Built with Next.js, Supabase, and Google Antigravity.</p>
      </footer>
    </div>
  );
}
