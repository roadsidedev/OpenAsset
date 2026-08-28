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

  const isTransportError = error.message?.includes('Transport') || error.message?.includes('URL was provided');
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center text-foreground">
      <h2 className="text-2xl font-bold">{isTransportError ? 'Network hiccup' : 'Connection failed'}</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {isTransportError
          ? 'A temporary RPC issue prevented loading. This usually resolves on retry.'
          : 'Please try again. If the problem persists, check your network connection.'}
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
