import Link from "next/link";

// Just enough markdown for Debbie and the client documents: headings, bullets,
// numbered lists, bold, italics, links and highlighted [GAP]s.
function inline(s: string, key: string) {
  return s.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\[GAP[^\]]*\]|_[^_\s][^_]*_|\*[^*\s][^*]*\*)/g).map((part, i) => {
    const k = `${key}-${i}`;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const [, text, href] = link;
      return href.startsWith("/") ? (
        <Link key={k} href={href} className="text-purple-700 dark:text-purple-300 underline underline-offset-2">{text}</Link>
      ) : (
        <a key={k} href={href} target="_blank" rel="noopener noreferrer" className="text-purple-700 dark:text-purple-300 underline underline-offset-2">{text}</a>
      );
    }
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={k}>{part.slice(2, -2)}</strong>;
    if (/^\[GAP/.test(part)) return <mark key={k} className="bg-yellow-200 dark:bg-yellow-500/30 text-inherit rounded px-0.5">{part}</mark>;
    if (/^(_[^_]+_|\*[^*]+\*)$/.test(part)) return <em key={k}>{part.slice(1, -1)}</em>;
    return part;
  });
}

export default function Markdown({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 text-sm leading-relaxed ${className}`}>
      {text.split("\n").map((line, i) => {
        const t = line.trim();
        const k = String(i);
        if (!t) return <div key={k} className="h-1" />;
        if (t.startsWith("# ")) return <h3 key={k} className="text-base font-bold mt-1">{inline(t.slice(2), k)}</h3>;
        if (t.startsWith("## ")) return <h4 key={k} className="text-sm font-semibold mt-3 text-purple-700 dark:text-purple-300">{inline(t.slice(3), k)}</h4>;
        if (t.startsWith("### ")) return <h5 key={k} className="text-sm font-semibold mt-2">{inline(t.slice(4), k)}</h5>;
        if (/^[-*] /.test(t)) return <p key={k} className="pl-4 relative before:content-['•'] before:absolute before:left-1 before:text-slate-400">{inline(t.slice(2), k)}</p>;
        const num = t.match(/^(\d+)[.)] (.*)$/);
        if (num) return <p key={k} className="pl-5 relative"><span className="absolute left-0 text-slate-400 tabular-nums">{num[1]}.</span>{inline(num[2], k)}</p>;
        return <p key={k}>{inline(t, k)}</p>;
      })}
    </div>
  );
}
