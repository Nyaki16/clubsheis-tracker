// Tiny shared avatar — image if avatar_url is set, gradient initial otherwise.
// One implementation so the same person looks the same in the nav, task rows,
// team page, and reassign popover.

type Size = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_CLASSES: Record<Size, string> = {
  xs: "w-4 h-4 text-[8px]",
  sm: "w-5 h-5 text-[10px]",
  md: "w-8 h-8 text-sm",
  lg: "w-10 h-10 text-base",
  xl: "w-20 h-20 text-xl",
};

export default function Avatar({
  name,
  url,
  size = "sm",
  className = "",
}: {
  name: string;
  url?: string | null;
  size?: Size;
  className?: string;
}) {
  const base = `${SIZE_CLASSES[size]} rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 ${className}`;
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={name} className={`${base} object-cover border border-slate-200`} />
    );
  }
  return (
    <div
      className={`${base} bg-gradient-to-br from-purple-500 to-pink-500 text-white font-semibold`}
    >
      {name?.[0]?.toUpperCase() ?? "?"}
    </div>
  );
}
