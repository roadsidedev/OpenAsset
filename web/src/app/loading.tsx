export default function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-ice-400" />
        <p className="text-sm text-muted-foreground">Loading OpenAsset Market...</p>
      </div>
    </div>
  );
}
