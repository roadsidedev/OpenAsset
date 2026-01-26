export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-white">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-800 border-t-red-600"></div>
        <p className="text-sm text-zinc-400">Loading Red Chips...</p>
      </div>
    </div>
  );
}
