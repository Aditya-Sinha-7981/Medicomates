export function Skeleton({ className = "" }) {
  return (
    <div
      className={`animate-pulse rounded-2xl bg-slate-100/80 dark:bg-slate-800/40 ${className}`}
    />
  );
}

