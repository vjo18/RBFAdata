import React, { useMemo, useState } from "react";
import {
  CartesianGrid,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, Number(v) || 0));
const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const fmt = (v, digits = 2) => Number.isFinite(Number(v)) ? Number(v).toFixed(digits) : "—";
const pct = (v, digits = 0) => Number.isFinite(Number(v)) ? `${Number(v).toFixed(digits)}%` : "—";

function rankValues(rows, key, higherBetter = true) {
  const vals = rows
    .map((r) => ({ team: r.team, value: num(r[key], null) }))
    .filter((r) => Number.isFinite(r.value))
    .sort((a, b) => higherBetter ? b.value - a.value : a.value - b.value);

  const rankMap = new Map(vals.map((r, i) => [r.team, i + 1]));
  const pctMap = new Map();
  vals.forEach((r, i) => {
    const quality = vals.length <= 1 ? 1 : 1 - (i / (vals.length - 1));
    pctMap.set(r.team, quality);
  });
  return { rankMap, pctMap, count: vals.length };
}

function buildTeamRows({ teamStats, homeAway, eventBins, firstScorer, substitutionStats }) {
  return (teamStats || []).map((s) => {
    const team = s.Team;
    const played = Math.max(1, num(s.Played));
    const ha = homeAway?.[team] || {};
    const fs = firstScorer?.[team] || {};
    const ev = eventBins?.[team] || {};
    const sub = (substitutionStats?.goalDiffAfterSub || []).find((r) => r.team === team);
    const concededFirst = fs?.resultsWhenConcededFirst?.overall || {};
    const lateFor = num(ev?.bins?.goalsFor?.["76-90"]?.count);
    const lateAgainst = num(ev?.bins?.goalsAgainst?.["76-90"]?.count);

    return {
      team,
      played,
      points: num(s.Points),
      ppg: num(s.Points) / played,
      gf90: num(s.GF) / played,
      ga90: num(s.GA) / played,
      gd90: num(s.GD) / played,
      elo: num(s.ELO),
      yellows90: num(s.YellowF) / played,
      homePpg: num(ha?.home?.points) / Math.max(1, num(ha?.home?.matches)),
      awayPpg: num(ha?.away?.points) / Math.max(1, num(ha?.away?.matches)),
      firstScorePct: num(fs?.scoredFirst?.total?.pctOfMatches),
      afterConcedePpg: num(concededFirst.W) * 3 + num(concededFirst.D),
      afterConcedeCount: num(concededFirst.count),
      lateGf90: lateFor / played,
      lateGa90: lateAgainst / played,
      subDelta20: num(sub?.delta20),
      gf: num(s.GF),
      ga: num(s.GA),
      gd: num(s.GD),
      w: num(s.W),
      d: num(s.G),
      l: num(s.V),
    };
  }).map((r) => ({
    ...r,
    afterConcedePpg: r.afterConcedeCount > 0 ? r.afterConcedePpg / r.afterConcedeCount : 0,
  }));
}

const metricDefs = [
  { key: "ppg", label: "Punten / match", short: "Resultaat", higher: true, format: (v) => fmt(v, 2) },
  { key: "gf90", label: "Goals voor / match", short: "Aanval", higher: true, format: (v) => fmt(v, 2) },
  { key: "ga90", label: "Goals tegen / match", short: "Verdediging", higher: false, format: (v) => fmt(v, 2) },
  { key: "elo", label: "ELO", short: "ELO", higher: true, format: (v) => fmt(v, 0) },
  { key: "homePpg", label: "Thuispunten / match", short: "Thuis", higher: true, format: (v) => fmt(v, 2) },
  { key: "awayPpg", label: "Uitpunten / match", short: "Uit", higher: true, format: (v) => fmt(v, 2) },
  { key: "firstScorePct", label: "Scoort eerst", short: "Eerste goal", higher: true, format: (v) => pct(v, 0) },
  { key: "afterConcedePpg", label: "Punten/match na eerste tegengoal", short: "Veerkracht", higher: true, format: (v) => fmt(v, 2) },
  { key: "lateGf90", label: "Goals 76–90 / match", short: "Slotfase +", higher: true, format: (v) => fmt(v, 2) },
  { key: "lateGa90", label: "Tegengoals 76–90 / match", short: "Slotfase −", higher: false, format: (v) => fmt(v, 2) },
  { key: "yellows90", label: "Gele kaarten / match", short: "Discipline", higher: false, format: (v) => fmt(v, 2) },
  { key: "subDelta20", label: "Δ doelsaldo 20' na wissel", short: "Wisselimpact", higher: true, format: (v) => (num(v) >= 0 ? "+" : "") + fmt(v, 2) },
];

function buildProfiles(rows) {
  const rankers = Object.fromEntries(
    metricDefs.map((m) => [m.key, rankValues(rows, m.key, m.higher)])
  );
  return rows.map((r) => ({
    ...r,
    metrics: Object.fromEntries(metricDefs.map((m) => {
      const ranker = rankers[m.key];
      return [m.key, {
        value: r[m.key],
        rank: ranker.rankMap.get(r.team),
        quality: ranker.pctMap.get(r.team),
        count: ranker.count,
        ...m,
      }];
    })),
  }));
}

function MetricBar({ metric }) {
  if (!metric) return null;
  const q = clamp(metric.quality);
  const rankText = Number.isFinite(metric.rank) ? `#${metric.rank}/${metric.count}` : "—";
  return (
    <div className="grid grid-cols-[7rem_1fr_4.5rem_4.5rem] md:grid-cols-[8rem_1fr_5rem_5rem] gap-2 items-center text-xs">
      <div className="font-medium text-gray-700 truncate" title={metric.label}>{metric.short}</div>
      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={q >= 0.75 ? "h-full bg-emerald-500" : q <= 0.25 ? "h-full bg-amber-500" : "h-full bg-sky-500"}
          style={{ width: `${Math.max(3, q * 100)}%` }}
        />
      </div>
      <div className="text-right tabular-nums text-gray-700">{metric.format(metric.value)}</div>
      <div className="text-right tabular-nums text-gray-500">{rankText}</div>
    </div>
  );
}

function KpiCard({ label, value, sub, emphasis = false }) {
  return (
    <div className={`rounded-xl border p-3 ${emphasis ? "border-sky-200 bg-sky-50/60" : "border-gray-200 bg-white"}`}>
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

function TeamProfileCard({ profile }) {
  if (!profile) return null;
  const metrics = metricDefs.map((m) => profile.metrics[m.key]).filter(Boolean);
  const strengths = [...metrics].sort((a, b) => b.quality - a.quality).slice(0, 3);
  const concerns = [...metrics].sort((a, b) => a.quality - b.quality).slice(0, 3);

  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold">Ploegdiagnose</h2>
            <p className="text-xs text-gray-500 mt-1">League ranks op basis van de 30 competitiewedstrijden.</p>
          </div>
          <span className="text-xs rounded-full bg-slate-100 px-2.5 py-1 text-gray-600">
            {profile.team}
          </span>
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 xl:grid-cols-[1.35fr_.9fr] gap-5">
        <div className="space-y-2.5">
          {metrics.map((m) => <MetricBar key={m.key} metric={m} />)}
          <div className="grid grid-cols-[7rem_1fr_4.5rem_4.5rem] md:grid-cols-[8rem_1fr_5rem_5rem] gap-2 text-[10px] text-gray-400 pt-1">
            <span />
            <span>zwakker ← positie in de reeks → sterker</span>
            <span className="text-right">waarde</span>
            <span className="text-right">rang</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3">
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
            <div className="text-xs font-semibold text-emerald-800">Sterkste datasignalen</div>
            <div className="mt-2 space-y-2">
              {strengths.map((m) => (
                <div key={m.key} className="flex justify-between gap-3 text-sm">
                  <span>{m.label}</span>
                  <span className="font-semibold whitespace-nowrap">#{m.rank}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
            <div className="text-xs font-semibold text-amber-800">Werkpunten / aandacht</div>
            <div className="mt-2 space-y-2">
              {concerns.map((m) => (
                <div key={m.key} className="flex justify-between gap-3 text-sm">
                  <span>{m.label}</span>
                  <span className="font-semibold whitespace-nowrap">#{m.rank}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-[11px] leading-relaxed text-gray-500 sm:col-span-2 xl:col-span-1">
            Rangen beschrijven wat in deze dataset gebeurde. Ze zijn nuttig als startpunt voor video- en tegenstanderanalyse,
            maar zijn geen causale beoordeling van trainer, tactiek of individuele spelers.
          </p>
        </div>
      </div>
    </div>
  );
}

function OpponentScout({ team, profiles }) {
  const [opponentChoice, setOpponentChoice] = useState("");
  const opponents = useMemo(
    () => profiles.filter((p) => p.team !== team),
    [profiles, team]
  );
  const own = profiles.find((p) => p.team === team);
  const defaultOpponent = useMemo(() => {
    if (!own) return opponents[0]?.team || "";
    return opponents
      .slice()
      .sort((a, b) => Math.abs(a.points - own.points) - Math.abs(b.points - own.points))[0]?.team || "";
  }, [opponents, own]);
  const opponent = opponents.some((p) => p.team === opponentChoice)
    ? opponentChoice
    : defaultOpponent;
  const opp = profiles.find((p) => p.team === opponent);
  if (!own || !opp) return null;

  const compareKeys = ["ppg", "gf90", "ga90", "elo", "homePpg", "awayPpg", "firstScorePct", "afterConcedePpg", "lateGf90", "lateGa90"];
  const oppMetrics = compareKeys.map((k) => opp.metrics[k]).filter(Boolean);
  const oppStrengths = [...oppMetrics].sort((a, b) => b.quality - a.quality).slice(0, 2);
  const oppWeaknesses = [...oppMetrics].sort((a, b) => a.quality - b.quality).slice(0, 2);

  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Tegenstanderscout</h2>
          <p className="text-xs text-gray-500 mt-1">Direct profielvergelijk op dezelfde league-schaal.</p>
        </div>
        <label className="text-xs text-gray-500">
          Vergelijk met
          <select
            className="block mt-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 min-w-56"
            value={opponent}
            onChange={(e) => setOpponentChoice(e.target.value)}
          >
            {opponents.map((p) => <option key={p.team} value={p.team}>{p.team}</option>)}
          </select>
        </label>
      </div>

      <div className="p-4">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs text-gray-500 bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Metric</th>
                <th className="px-3 py-2 text-right">{team}</th>
                <th className="px-3 py-2 text-right">{opponent}</th>
                <th className="px-3 py-2 text-right">Opp. rang</th>
              </tr>
            </thead>
            <tbody>
              {compareKeys.map((key) => {
                const a = own.metrics[key];
                const b = opp.metrics[key];
                return (
                  <tr key={key} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-medium">{a.label}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{a.format(a.value)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{b.format(b.value)}</td>
                    <td className="px-3 py-2 text-right text-gray-500">#{b.rank}/{b.count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
            <div className="text-xs font-semibold text-emerald-800">Waar {opponent} bovengemiddeld scoort</div>
            <ul className="mt-2 space-y-1 text-sm">
              {oppStrengths.map((m) => <li key={m.key}>• {m.label}: #{m.rank} in de reeks</li>)}
            </ul>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
            <div className="text-xs font-semibold text-amber-800">Mogelijke aanvalspunten</div>
            <ul className="mt-2 space-y-1 text-sm">
              {oppWeaknesses.map((m) => <li key={m.key}>• {m.label}: #{m.rank} in de reeks</li>)}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function LeagueLandscape({ profiles, selectedTeam }) {
  const rawData = profiles.map((p) => ({
    team: p.team,
    short: p.team
      .replace(/^K\.?\s*/i, "")
      .replace(/\s+A$/i, "")
      .replace(/Sport$/i, "Sp.")
      .slice(0, 17),
    gf: p.gf90,
    ga: p.ga90,
    points: p.points,
  }));
  const gaSorted = rawData.map((r) => r.ga).sort((a, b) => a - b);
  const secondLargestGa = gaSorted.length > 1 ? gaSorted[gaSorted.length - 2] : gaSorted[0] || 0;
  const largestGa = gaSorted[gaSorted.length - 1] || 0;
  const hasGaOutlier = largestGa > Math.max(3, secondLargestGa * 1.5);
  const gaVisualCap = hasGaOutlier ? secondLargestGa + 0.45 : largestGa + 0.15;
  const data = rawData.map((r) => ({
    ...r,
    gaPlot: Math.min(r.ga, gaVisualCap),
    short: r.ga > gaVisualCap ? `${r.short}*` : r.short,
  }));
  const avgGf = rawData.reduce((s, r) => s + r.gf, 0) / Math.max(1, rawData.length);
  const avgGa = rawData.reduce((s, r) => s + r.ga, 0) / Math.max(1, rawData.length);
  const minGa = Math.max(0, Math.min(...rawData.map((r) => r.ga)) - 0.15);
  const maxGa = gaVisualCap;
  const minGf = Math.max(0, Math.min(...rawData.map((r) => r.gf)) - 0.15);
  const maxGf = Math.max(...rawData.map((r) => r.gf)) + 0.15;

  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-xl font-semibold">League landscape — aanval vs verdediging</h2>
        <p className="text-xs text-gray-500 mt-1">Rechts = meer goals voor. Hoger = minder tegengoals. Stippellijnen = competitiegemiddelde.</p>
      </div>
      <div className="h-[430px] p-3">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 22, right: 30, bottom: 30, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="gf"
              name="Goals voor / match"
              domain={[minGf, maxGf]}
              tickFormatter={(v) => Number(v).toFixed(1)}
              label={{ value: "Goals voor / match →", position: "insideBottom", offset: -18 }}
            />
            <YAxis
              type="number"
              dataKey="gaPlot"
              name="Goals tegen / match"
              domain={[minGa, maxGa]}
              reversed
              tickFormatter={(v) => Number(v).toFixed(1)}
              label={{ value: "← minder tegengoals", angle: -90, position: "insideLeft" }}
            />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (!active || !payload?.[0]?.payload) return null;
                const r = payload[0].payload;
                return (
                  <div className="rounded-lg border border-gray-200 bg-white p-2 text-xs shadow-sm">
                    <div className="font-semibold">{r.team}</div>
                    <div>GF/match: {fmt(r.gf, 2)}</div>
                    <div>GA/match: {fmt(r.ga, 2)}</div>
                    <div>Punten: {r.points}</div>
                  </div>
                );
              }}
            />
            <ReferenceLine x={avgGf} stroke="#94a3b8" strokeDasharray="5 5" />
            <ReferenceLine y={Math.min(avgGa, gaVisualCap)} stroke="#94a3b8" strokeDasharray="5 5" />
            <Scatter data={data.filter((r) => r.team !== selectedTeam)} fill="#94a3b8">
              <LabelList dataKey="short" position="top" fontSize={9} />
            </Scatter>
            <Scatter data={data.filter((r) => r.team === selectedTeam)} fill="#0284c7">
              <LabelList dataKey="short" position="top" fontSize={11} fontWeight={700} />
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      {hasGaOutlier && (
        <div className="px-4 pb-3 text-[11px] text-gray-500">
          * Extreme defensieve outlier visueel afgekapt zodat de overige ploegen leesbaar blijven; de tooltip toont de echte waarde.
        </div>
      )}
    </div>
  );
}

function percentileMap(rows, key) {
  const sorted = rows.slice().sort((a, b) => a[key] - b[key]);
  const map = new Map();
  sorted.forEach((r, i) => {
    const p = sorted.length <= 1 ? 100 : 100 * i / (sorted.length - 1);
    map.set(r.id, p);
  });
  return map;
}

function LeagueScoutingBoard({ teamPlayerImpact, selectedTeam }) {
  const [sortKey, setSortKey] = useState("mvp");
  const [typeFilter, setTypeFilter] = useState("all");
  const [limit, setLimit] = useState(15);

  const players = useMemo(() => {
    const reliableMinutes = num(teamPlayerImpact?.meta?.reliableMinutes, 1080);
    const base = [];
    for (const [team, rec] of Object.entries(teamPlayerImpact?.teams || {})) {
      for (const p of rec?.players || []) {
        if (num(p.minutes) < reliableMinutes) continue;
        const rapmStabFactor = Math.max(0, (num(p.rapmStability) - 0.5) / 0.5);
        const xStabFactor = Math.max(0, (num(p.xPtsStability) - 0.5) / 0.5);
        const rapmTotalAdj = num(p.rapmPer90) * (num(p.minutes) / 90) * rapmStabFactor;
        const xTotalAdj = num(p.xPtsPer90) * (num(p.minutes) / 90) * xStabFactor;
        base.push({
          id: `${team}|||${p.name}`,
          team,
          name: p.name,
          type: p.type,
          minutes: num(p.minutes),
          goals: num(p.goals),
          penalties: num(p.penalties),
          rapm: num(p.rapmPer90),
          xpts: num(p.xPtsPer90),
          rapmStability: num(p.rapmStability),
          xPtsStability: num(p.xPtsStability),
          rapmTotalAdj,
          xTotalAdj,
          goals90: num(p.goals) * 90 / Math.max(1, num(p.minutes)),
          strongSignal:
            num(p.rapmCiLow) > 0 &&
            num(p.xPtsCiLow) > 0 &&
            num(p.rapmStability) >= 0.95 &&
            num(p.xPtsStability) >= 0.95,
        });
      }
    }
    const rp = percentileMap(base, "rapmTotalAdj");
    const xp = percentileMap(base, "xTotalAdj");
    return base.map((p) => ({
      ...p,
      mvp: 0.45 * num(rp.get(p.id)) + 0.55 * num(xp.get(p.id)),
    }));
  }, [teamPlayerImpact]);

  const filtered = players
    .filter((p) => typeFilter === "all" || (typeFilter === "keeper" ? String(p.type).toLowerCase() === "keeper" : String(p.type).toLowerCase() !== "keeper"))
    .sort((a, b) => {
      if (sortKey === "rapm") return b.rapmTotalAdj - a.rapmTotalAdj;
      if (sortKey === "xpts") return b.xTotalAdj - a.xTotalAdj;
      if (sortKey === "goals") return b.goals - a.goals;
      if (sortKey === "goals90") return b.goals90 - a.goals90;
      return b.mvp - a.mvp;
    })
    .slice(0, limit);

  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Competitiebrede spelersscouting</h2>
          <p className="text-xs text-gray-500 mt-1">
            Alleen spelers met ≥ {Math.round(num(teamPlayerImpact?.meta?.reliableMinutes, 1080))} minuten. MVP-index combineert totale,
            stabiliteitsgecorrigeerde RAPM (45%) en xPts-impact (55%).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm" value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
            <option value="mvp">MVP-index</option>
            <option value="rapm">Totale RAPM-impact</option>
            <option value="xpts">Totale xPts-impact</option>
            <option value="goals">Goals</option>
            <option value="goals90">Goals / 90</option>
          </select>
          <select className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">Alle spelers</option>
            <option value="field">Veldspelers</option>
            <option value="keeper">Keepers</option>
          </select>
          <select className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            <option value={10}>Top 10</option>
            <option value={15}>Top 15</option>
            <option value={25}>Top 25</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Speler</th>
              <th className="px-3 py-2 text-left">Ploeg</th>
              <th className="px-3 py-2 text-right">Min.</th>
              <th className="px-3 py-2 text-right">MVP</th>
              <th className="px-3 py-2 text-right">RAPM/90</th>
              <th className="px-3 py-2 text-right">xPts/90</th>
              <th className="px-3 py-2 text-right">Goals</th>
              <th className="px-3 py-2 text-left">Signaal</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr key={p.id} className={p.team === selectedTeam ? "bg-sky-50" : "hover:bg-gray-50"}>
                <td className="px-3 py-2">{i + 1}</td>
                <td className="px-3 py-2 font-medium whitespace-nowrap">{p.name}</td>
                <td className="px-3 py-2 whitespace-nowrap">{p.team}</td>
                <td className="px-3 py-2 text-right">{Math.round(p.minutes)}</td>
                <td className="px-3 py-2 text-right font-semibold">{fmt(p.mvp, 1)}</td>
                <td className="px-3 py-2 text-right">{p.rapm >= 0 ? "+" : ""}{fmt(p.rapm, 3)}</td>
                <td className="px-3 py-2 text-right">{p.xpts >= 0 ? "+" : ""}{fmt(p.xpts, 3)}</td>
                <td className="px-3 py-2 text-right">{p.goals}</td>
                <td className="px-3 py-2">
                  {p.strongSignal
                    ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-medium text-emerald-800">robuust +</span>
                    : <span className="text-xs text-gray-400">context nodig</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t border-gray-100 text-[11px] leading-relaxed text-gray-500">
        De MVP-index is een modelgebaseerde shortlist, geen positie-onafhankelijke waarheid. De data bevat geen betrouwbare veldposities;
        gebruik daarom video, rol en teamcontext vóór je spelers rechtstreeks vergelijkt.
      </div>
    </div>
  );
}

export default function AnalystDashboard({
  team,
  teamStats,
  homeAway,
  eventBins,
  firstScorer,
  substitutionStats,
  teamPlayerImpact,
}) {
  const rows = useMemo(
    () => buildTeamRows({ teamStats, homeAway, eventBins, firstScorer, substitutionStats }),
    [teamStats, homeAway, eventBins, firstScorer, substitutionStats]
  );
  const profiles = useMemo(() => buildProfiles(rows), [rows]);
  const profile = profiles.find((p) => p.team === team);
  const standing = [...rows].sort((a, b) => (b.points - a.points) || (b.gd - a.gd) || (b.gf - a.gf));
  const standingRank = standing.findIndex((r) => r.team === team) + 1;
  const topImpact = (teamPlayerImpact?.teams?.[team]?.players || []).find((p) => p.reliable);

  if (!profile) return null;

  return (
    <div id="analyse-overzicht" className="space-y-6 mb-10">
      <nav className="rounded-xl bg-slate-900 text-white px-3 py-2 flex flex-wrap gap-1 text-sm">
        <a href="#analyse-overzicht" className="rounded-lg px-3 py-2 hover:bg-white/10">Overzicht</a>
        <a href="#league-analyse" className="rounded-lg px-3 py-2 hover:bg-white/10">Reeks</a>
        <a href="#wedstrijdpatronen" className="rounded-lg px-3 py-2 hover:bg-white/10">Wedstrijdpatronen</a>
        <a href="#spelers-analyse" className="rounded-lg px-3 py-2 hover:bg-white/10">Spelers</a>
        <a href="#detailanalyse" className="rounded-lg px-3 py-2 hover:bg-white/10">Detail</a>
      </nav>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard label="Eindpositie" value={standingRank ? `#${standingRank}` : "—"} sub={`${standing.length} ploegen`} emphasis />
        <KpiCard label="Punten" value={Math.round(profile.points)} sub={`${fmt(profile.ppg, 2)} per match`} />
        <KpiCard label="Doelsaldo" value={profile.gd >= 0 ? `+${profile.gd}` : profile.gd} sub={`${profile.gf}–${profile.ga}`} />
        <KpiCard label="ELO" value={fmt(profile.elo, 0)} sub={`#${profile.metrics.elo.rank} in reeks`} />
        <KpiCard label="Eerste goal" value={pct(profile.firstScorePct, 0)} sub={`#${profile.metrics.firstScorePct.rank} in reeks`} />
        <KpiCard
          label="Top impactspeler"
          value={topImpact ? topImpact.name.split(" ").slice(-1)[0] : "—"}
          sub={topImpact ? `${Math.round(topImpact.minutes)} min · index ${fmt(topImpact.teamImpactScore, 1)}` : "geen data"}
        />
      </div>

      <TeamProfileCard profile={profile} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <OpponentScout team={team} profiles={profiles} />
        <div className="rounded-2xl bg-slate-900 text-white p-5">
          <div className="text-xs uppercase tracking-wider text-slate-400">Analistenkader</div>
          <h2 className="text-xl font-semibold mt-1">Zo gebruik je deze bovenlaag</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-200 leading-relaxed">
            <p><strong className="text-white">1. Diagnose:</strong> begin bij de league ranks, niet bij één losse grafiek. Zoek extreme sterktes en zwaktes.</p>
            <p><strong className="text-white">2. Tegenstander:</strong> vergelijk dezelfde metrics en bepaal welke matchup video-analyse verdient.</p>
            <p><strong className="text-white">3. Spelers:</strong> gebruik de robuuste impactshortlist om kandidaten te vinden; valideer daarna rol, minuten en beelden.</p>
            <p><strong className="text-white">4. Detail:</strong> goal timing, eerste goal, rust/eindstand, wissels en segmenten verklaren waar de patronen ontstaan.</p>
          </div>
          <div className="mt-5 rounded-xl bg-white/10 p-3 text-xs text-slate-300">
            Dataset: {teamPlayerImpact?.meta?.validatedMatches || 240} gevalideerde competitiewedstrijden ·
            RAPM α {teamPlayerImpact?.meta?.rapmAlpha || "—"} · xPts α {teamPlayerImpact?.meta?.xPtsAlpha || "—"} ·
            {teamPlayerImpact?.meta?.bootstrapRuns || 200} match-bootstraps.
          </div>
        </div>
      </div>

      <div id="league-analyse" className="space-y-6 scroll-mt-4">
        <LeagueLandscape profiles={profiles} selectedTeam={team} />
        <LeagueScoutingBoard teamPlayerImpact={teamPlayerImpact} selectedTeam={team} />
      </div>
    </div>
  );
}
