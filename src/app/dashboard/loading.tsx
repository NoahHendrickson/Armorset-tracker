export default function DashboardLoading() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-4 py-3 sm:h-14 sm:flex-nowrap sm:px-6 sm:py-0"
        aria-hidden
      >
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-pulse rounded-none bg-muted" />
          <div className="h-4 w-36 animate-pulse rounded-none bg-muted" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 animate-pulse rounded-none bg-muted" />
          <div className="h-9 w-9 animate-pulse rounded-none bg-muted" />
          <div className="h-8 w-24 animate-pulse rounded-none bg-muted" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6">
        <div className="h-10 w-full max-w-3xl animate-pulse rounded-none bg-muted" />
        <div className="grid flex-1 grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-none border border-border bg-muted/40"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
