import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 text-center">
      <div className="space-y-6 max-w-md">
        <div className="space-y-2">
          <h1 className="text-6xl font-bold text-foreground tracking-tight">404</h1>
          <h2 className="text-xl font-bold text-foreground">Page not found</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/markets"
          className="inline-flex items-center justify-center rounded-2xl bg-ice-300 dark:bg-ice-400 px-6 py-3 text-sm font-bold text-slate-900 transition-premium hover:bg-ice-400 dark:hover:bg-ice-300 active-press"
        >
          Back to Markets
        </Link>
      </div>
    </div>
  );
}
