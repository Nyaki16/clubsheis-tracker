import Link from "next/link";
import { CalendarCheck, CheckCircle2, Flame, PartyPopper, Send, Target, TrendingUp, Trophy, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { loadDashboard, type Win } from "@/lib/dashboard";
import { latestBriefing } from "@/lib/briefing";
import { rand } from "@/lib/flow";
import Avatar from "@/components/avatar";
import { BriefingCard, TargetEditor } from "./dashboard-bits";

const card = "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5";
const h2 = "font-semibold flex items-center gap-2";
const pct = (n: number) => `${Math.round(n * 100)}%`;
const ago = (iso: string, now: string) => {
  const d = Math.floor((new Date(now).getTime() - new Date(iso).getTime()) / 864e5);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};

const WIN_ICON: Record<Win["kind"], React.ReactNode> = {
  paid: <UserPlus className="w-4 h-4 text-emerald-600" />,
  accepted: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
  proposal: <Send className="w-4 h-4 text-purple-600" />,
  yellow: <CalendarCheck className="w-4 h-4 text-yellow-600" />,
  published: <PartyPopper className="w-4 h-4 text-pink-600" />,
  flow: <Trophy className="w-4 h-4 text-amber-600" />,
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const [d, briefing, { data: me }] = await Promise.all([
    loadDashboard(supabase),
    latestBriefing(supabase),
    supabase.from("profiles").select("is_admin").eq("id", auth.user?.id ?? "").maybeSingle(),
  ]);
  const isAdmin = !!me?.is_admin;

  const got = d.newThisMonth.length;
  const onPace = got >= Math.floor(d.expectedByNow);
  const forecast = Math.round(d.forecast);
  const maxBar = Math.max(d.target, ...d.history.map((h) => h.count), 1);
  const top = d.people[0];
  const fmtR = (n: number) => rand(n);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {d.month} · day {d.dayOfMonth} of {d.daysInMonth} · {d.glance.activeClients} active clients · {d.glance.openTasks} open tasks
          </p>
        </div>
      </header>

      {/* Target + funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className={`${card} lg:col-span-2 flex flex-col gap-4`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className={h2}>
              <Target className="w-4 h-4 text-purple-600" /> New clients this month
            </h2>
            <TargetEditor target={d.target} canEdit={isAdmin} />
          </div>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <p className="text-5xl font-bold tabular-nums leading-none">
              {got}
              <span className="text-2xl text-slate-400 font-semibold"> / {d.target}</span>
            </p>
            <div className="text-sm">
              <p className={`font-semibold ${onPace ? "text-emerald-600" : "text-amber-600"}`}>
                {got >= d.target
                  ? "Target hit! 🎉"
                  : onPace
                  ? `On pace (${d.expectedByNow.toFixed(1)} expected by today)`
                  : `Behind pace: ${d.expectedByNow.toFixed(1)} expected by today`}
              </p>
              <p className="text-slate-500">
                Forecast for month end: <b className="text-slate-800 dark:text-slate-200">about {forecast}</b>
                {d.needed > 0 && <> · {d.needed} more needed in {d.daysInMonth - d.dayOfMonth} days</>}
              </p>
            </div>
          </div>
          <div className="relative h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full" style={{ width: `${Math.min(100, (got / d.target) * 100)}%` }} />
            <div className="absolute inset-y-0 bg-slate-400/30 border-r-2 border-dashed border-slate-500" style={{ left: 0, width: `${Math.min(100, (Math.min(forecast, d.target) / d.target) * 100)}%` }} title="Forecast" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {d.newThisMonth.length ? (
              d.newThisMonth.map((c) => (
                <Link key={c.id} href={`/clients/${c.id}`} className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 hover:underline">
                  {c.business_name || c.name}
                </Link>
              ))
            ) : (
              <span className="text-xs text-slate-400">No new paying clients yet this month.</span>
            )}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Last 6 months</p>
            <div className="flex items-end gap-3 h-24">
              {d.history.map((h) => (
                <div key={h.key} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs tabular-nums text-slate-500">{h.count}</span>
                  <div className="w-full flex-1 flex items-end relative">
                    <div className="absolute inset-x-0 border-t border-dashed border-slate-300 dark:border-slate-600" style={{ bottom: `${(d.target / maxBar) * 100}%` }} />
                    <div
                      className={`w-full rounded-t ${h.current ? "bg-gradient-to-t from-purple-600 to-pink-600" : h.count >= d.target ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`}
                      style={{ height: `${(h.count / maxBar) * 100}%`, minHeight: h.count ? 4 : 0 }}
                    />
                  </div>
                  <span className={`text-xs ${h.current ? "font-semibold" : "text-slate-400"}`}>{h.label}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Dashed line: the target. A client counts in the month their Ghutte payment came in (older clients: when their onboarding clock started).</p>
          </div>
        </section>

        <section className={`${card} flex flex-col gap-3`}>
          <h2 className={h2}>
            <TrendingUp className="w-4 h-4 text-purple-600" /> Sales pipeline · {d.month.split(" ")[0]}
          </h2>
          {[
            ["Discovery calls held", d.funnel.callsHeld, `${d.funnel.callsUpcoming} more booked`],
            ["Proposals sent", d.funnel.proposalsSent, ""],
            ["Proposals accepted", d.funnel.accepted, ""],
            ["Paid (new clients)", d.funnel.paid, ""],
          ].map(([label, n, note], i) => (
            <div key={String(label)} className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex justify-between text-sm">
                  <span>{label}</span>
                  <span className="font-semibold tabular-nums">{n}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-1 overflow-hidden">
                  <div className="h-full bg-purple-500/70 rounded-full" style={{ width: `${Math.max(Number(n) ? 6 : 0, (Number(n) / Math.max(d.funnel.callsHeld + d.funnel.callsUpcoming, d.funnel.proposalsSent, 1)) * 100)}%`, opacity: 1 - i * 0.15 }} />
                </div>
                {note && <p className="text-[11px] text-slate-400 mt-0.5">{note}</p>}
              </div>
            </div>
          ))}
          <p className="text-[11px] text-slate-400">
            Recent conversion: call → paid {pct(d.rates.callToPaid)} · proposal → paid {pct(d.rates.sentToPaid)} · accepted → paid {pct(d.rates.acceptedToPaid)}
          </p>
          <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Deals to chase</p>
            {d.chase.length ? (
              <ul className="flex flex-col gap-1.5">
                {d.chase.slice(0, 6).map((x) => (
                  <li key={x.client.id} className="text-sm flex justify-between gap-2">
                    <Link href={`/clients/${x.client.id}`} className="truncate hover:underline">{x.client.business_name || x.client.name}</Link>
                    <span className="text-xs text-slate-400 whitespace-nowrap">{x.why.toLowerCase()} · {ago(x.since, d.now)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">Nothing waiting on a client right now.</p>
            )}
          </div>
        </section>
      </div>

      {/* Revenue: admins only */}
      {isAdmin && (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            ["Monthly recurring", fmtR(d.revenue.mrr), `+${fmtR(d.revenue.newMrrThisMonth)} new this month`],
            ["Once-off this month", fmtR(d.revenue.onceOffThisMonth), `from ${got} new client${got === 1 ? "" : "s"}`],
            ["Open pipeline", fmtR(d.revenue.pipelineOnceOff), `+${fmtR(d.revenue.pipelineMonthly)}/month if all close`],
            ["Income forecast", fmtR(d.forecastMonthIncome), "recurring + once-off + likely deals"],
          ].map(([label, value, note]) => (
            <div key={label} className={card}>
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-2xl font-bold tabular-nums mt-1">{value}</p>
              <p className="text-[11px] text-slate-400 mt-1">{note}</p>
            </div>
          ))}
          <p className="col-span-2 lg:col-span-4 text-[11px] text-slate-400 -mt-2">
            Admins only. From the prices in each client&apos;s proposal{d.revenue.unpriced ? `; ${d.revenue.unpriced} paying clients have no proposal prices yet, so they're not counted` : ""}.
          </p>
        </section>
      )}

      {/* Debbie + wins */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <BriefingCard briefing={briefing} />
        </div>
        <section className={`${card} flex flex-col gap-3`}>
          <h2 className={h2}>
            <PartyPopper className="w-4 h-4 text-pink-600" /> Wins · last 2 weeks
          </h2>
          {d.wins.length ? (
            <ul className="flex flex-col gap-2.5">
              {d.wins.map((w, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-0.5">{WIN_ICON[w.kind]}</span>
                  <span className="flex-1 min-w-0">
                    {w.clientId ? <Link href={`/clients/${w.clientId}`} className="hover:underline">{w.text}</Link> : w.text}
                    <span className="block text-[11px] text-slate-400">{ago(w.at, d.now)}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">No wins recorded yet. They appear as clients pay, accept proposals and work gets published.</p>
          )}
        </section>
      </div>

      {/* Team + bottlenecks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className={`${card} lg:col-span-2 flex flex-col gap-3`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className={h2}>
              <Flame className="w-4 h-4 text-orange-500" /> Who&apos;s on fire this week
            </h2>
            <span className="text-xs text-slate-500">
              {d.teamDoneWeek} tasks finished · last week {d.teamDoneLastWeek}
              {d.teamDoneLastWeek ? ` (${d.teamDoneWeek >= d.teamDoneLastWeek ? "▲" : "▼"} ${Math.abs(d.teamDoneWeek - d.teamDoneLastWeek)})` : ""}
            </span>
          </div>
          {top && top.doneWeek > 0 && (
            <div className="flex items-center gap-3 rounded-lg bg-gradient-to-r from-amber-50 to-pink-50 dark:from-amber-500/10 dark:to-pink-500/10 px-4 py-3">
              <Trophy className="w-6 h-6 text-amber-500 shrink-0" />
              <p className="text-sm">
                <b>{top.name}</b> leads the week with <b>{top.doneWeek}</b> tasks finished
                {top.onTime !== null ? `, ${pct(top.onTime)} on time` : ""}
                {top.streak >= 3 ? ` and a ${top.streak}-day streak 🔥` : ""}.
              </p>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="py-1.5 font-semibold">Person</th>
                  <th className="py-1.5 font-semibold text-right">Done this week</th>
                  <th className="py-1.5 font-semibold text-right">On time</th>
                  <th className="py-1.5 font-semibold text-right">Streak</th>
                  <th className="py-1.5 font-semibold text-right">Open</th>
                  <th className="py-1.5 font-semibold text-right">Overdue</th>
                </tr>
              </thead>
              <tbody>
                {d.people.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-2">
                      <span className="flex items-center gap-2">
                        <Avatar name={p.name} url={p.avatar_url} size="sm" />
                        {p.name}
                      </span>
                    </td>
                    <td className="py-2 text-right tabular-nums font-semibold">{p.doneWeek}</td>
                    <td className="py-2 text-right tabular-nums">{p.onTime === null ? "–" : pct(p.onTime)}</td>
                    <td className="py-2 text-right tabular-nums">{p.streak ? `${p.streak}d${p.streak >= 3 ? " 🔥" : ""}` : "–"}</td>
                    <td className="py-2 text-right tabular-nums">{p.open}</td>
                    <td className={`py-2 text-right tabular-nums ${p.overdue ? "text-rose-600 font-semibold" : ""}`}>{p.overdue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-400">Done = Closed Out or Published, counted the day the task last changed. Streak = weekdays in a row with something finished.</p>
        </section>

        <section className={`${card} flex flex-col gap-3`}>
          <h2 className={h2}>Bottlenecks</h2>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/daily?due=overdue" className="rounded-lg bg-rose-50 dark:bg-rose-500/10 px-3 py-2 hover:ring-1 ring-rose-300">
              <p className="text-2xl font-bold text-rose-600 tabular-nums">{d.bottlenecks.overdue}</p>
              <p className="text-xs text-rose-700 dark:text-rose-300">overdue tasks</p>
            </Link>
            <Link href="/daily" className="rounded-lg bg-amber-50 dark:bg-amber-500/10 px-3 py-2 hover:ring-1 ring-amber-300">
              <p className="text-2xl font-bold text-amber-600 tabular-nums">{d.bottlenecks.unassigned}</p>
              <p className="text-xs text-amber-700 dark:text-amber-300">with no owner</p>
            </Link>
          </div>
          <Block title="Most overdue by client" empty="No overdue client work.">
            {d.bottlenecks.overdueByClient.map((x) => (
              <Row key={x.client.id} href={`/clients/${x.client.id}`} left={x.client.name} right={`${x.n} overdue`} />
            ))}
          </Block>
          <Block title="Waiting on clients 5+ days" empty="Nothing waiting long on a client.">
            {d.bottlenecks.waitingOnClients.map((w) => (
              <Row key={w.task.id} href={w.client ? `/clients/${w.client.id}` : "/daily"} left={`${w.task.title}${w.client ? ` · ${w.client.name}` : ""}`} right={`${w.days}d`} />
            ))}
          </Block>
          <Block title="No progress in 14+ days" empty="Every client flow has moved in the last two weeks.">
            {d.bottlenecks.stuckClients.map((s) => (
              <Row key={s.client.id} href={`/clients/${s.client.id}`} left={s.client.name} right={`${s.days}d`} />
            ))}
          </Block>
        </section>
      </div>
    </div>
  );
}

function Block({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">{title}</p>
      {children.length ? <ul className="flex flex-col gap-1">{children}</ul> : <p className="text-xs text-slate-400">{empty}</p>}
    </div>
  );
}

function Row({ href, left, right }: { href: string; left: string; right: string }) {
  return (
    <li className="flex justify-between gap-2 text-sm">
      <Link href={href} className="truncate hover:underline">{left}</Link>
      <span className="text-xs text-slate-400 whitespace-nowrap">{right}</span>
    </li>
  );
}
