/**
 * This file is automatically shown by Next.js while the dashboard
 * page is loading (server-side data fetching).
 */
export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Navbar skeleton */}
      <div className="h-14 border-b border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-950" />

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-2">
            <div className="h-7 w-24 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
            <div className="h-4 w-16 bg-neutral-100 dark:bg-neutral-900 rounded animate-pulse" />
          </div>
          <div className="h-9 w-24 bg-neutral-200 dark:bg-neutral-800 rounded-md animate-pulse" />
        </div>

        {/* Events list skeleton */}
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-xl px-5 py-4"
            >
              <div className="space-y-2">
                <div className="h-4 w-48 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
                <div className="h-3 w-32 bg-neutral-100 dark:bg-neutral-900 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
