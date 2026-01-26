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
    <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
      <h2 className="text-2xl font-bold">Something went wrong!</h2>
      <p className="mt-2 text-zinc-400">
        We apologize for the inconvenience. Please try again.
      </p>
      <button
        onClick={() => reset()}
        className="mt-6 rounded-full bg-red-600 px-6 py-2 font-semibold transition hover:bg-red-500"
      >
        Try again
      </button>
    </div>
  );
}
