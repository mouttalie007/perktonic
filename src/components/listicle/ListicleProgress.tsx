/** "3 / 12" position indicator + a thin progress bar (spec §4). */
export function ListicleProgress({
  position,
  total,
  className = "",
}: {
  position: number;
  total: number;
  className?: string;
}) {
  const pct = Math.round((position / total) * 100);
  return (
    <div className={className}>
      <div className="text-muted flex items-baseline justify-between text-[0.8rem] font-semibold">
        <span>
          <span className="text-ink tabular-nums">{position}</span>
          <span className="mx-1">/</span>
          <span className="tabular-nums">{total}</span>
        </span>
        <span className="text-meta tracking-[0.12em] uppercase">
          {position === total ? "Last" : `${pct}%`}
        </span>
      </div>
      <div
        className="bg-line mt-1.5 h-1 overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={position}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={`Item ${position} of ${total}`}
      >
        <div
          className="bg-brand h-full rounded-full transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
