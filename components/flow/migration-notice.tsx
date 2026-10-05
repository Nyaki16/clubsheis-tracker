export function MigrationNotice() {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/40 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
      <p className="font-semibold">The client flow database update hasn&apos;t been run yet.</p>
      <p className="mt-0.5">
        Open the Supabase SQL editor and run <code className="font-mono text-xs">supabase/migrations/0021_client_flow.sql</code>, then refresh this page.
      </p>
    </div>
  );
}
