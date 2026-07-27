"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background text-foreground">
      <h2 className="text-2xl font-bold">Connection failed</h2>
      <p className="mt-2 text-muted-foreground">
        Please try again. If the problem persists, check your network connection.
      </p>
      <button
        onClick={() => reset()}
        className="mt-6 rounded-full bg-ice-300 dark:bg-ice-400 px-6 py-2 font-semibold text-slate-900 transition-premium hover:bg-ice-400 dark:hover:bg-ice-300 active-press"
      >
        Try again
      </button>
    </div>
  );
}
