// Compact circular progress indicator with the % shown inside.

export default function ProgressDonut({
  percent,
  size = 36,
  stroke = 3.5,
  color = "#10b981", // emerald-500
  trackColor = "#e2e8f0", // slate-200
  className = "",
}: {
  percent: number;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  className?: string;
}) {
  const safe = Math.max(0, Math.min(100, Math.round(percent)));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (safe / 100) * c;

  return (
    <div
      className={`relative inline-flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-label={`${safe}% complete`}
      role="img"
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 -rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
        />
        {safe > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${c}`}
            strokeLinecap="round"
            className="transition-[stroke-dasharray] duration-300"
          />
        )}
      </svg>
      <span className="relative text-[10px] font-semibold text-slate-700 leading-none">
        {safe}
      </span>
    </div>
  );
}
