export function GridSkeleton({ count = 4, label }: { count?: number; label: string }) {
  return (
    <div className="grid" aria-busy="true" aria-live="polite" aria-label={label}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} aria-hidden="true">
          <div className="skeleton" style={{ aspectRatio: '1 / 1', marginBottom: 'var(--space-3)' }} />
          <div className="skeleton" style={{ height: 16, width: '70%' }} />
        </div>
      ))}
    </div>
  );
}
