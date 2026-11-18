"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Square } from "lucide-react";

type Rost = { slug: string; name: string; role: string };
type Talk = { id: string; from: string; to: string; brief: string; status: "working" | "done"; result: string };
type Activity = { roster: Rost[]; agents: Record<string, { state: "idle" | "working"; note: string }>; talks: Talk[] };

const COLORS = ["#34e0f5", "#b79bff", "#ffb454", "#5fe3a1", "#ff7a90", "#7aa2ff", "#f5e663"];
const SKIN = ["#f1c9a5", "#d9a47c", "#a8744f", "#f4d6bd", "#8d5a3b", "#e8b98f", "#c68b63"];
const HAIR = ["#1d1b2a", "#3a2418", "#c9a04a", "#6b2f1f", "#222a3d", "#8a8f9c", "#2b1b12"];
const W = 960, COLS = 3, DX = 300, ROW_H = 190;

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const short = (s: string, n = 90) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const wrap = (s: string, w = 26, max = 3) => {
  const out: string[] = []; let cur = "";
  for (const word of short(s, w * max).split(" ")) { if ((cur + " " + word).trim().length > w) { out.push(cur); cur = word; } else cur = (cur + " " + word).trim(); }
  if (cur) out.push(cur);
  return out.slice(0, max);
};

/** Speech bubble above a point (x,y is where its tail touches). */
function Bubble({ x, y, text, tone = "talk" }: { x: number; y: number; text: string; tone?: "talk" | "done" }) {
  const lines = wrap(text, 24); const h = 12 + lines.length * 14; const w = 176;
  const stroke = tone === "done" ? "var(--good)" : "var(--accent)";
  return (
    <g transform={`translate(${x},${y})`} className="office-bubble" aria-hidden="true">
      <rect x={-w / 2} y={-h - 8} width={w} height={h} rx={9} style={{ fill: "var(--panel)", stroke, strokeWidth: 1.4 }} />
      <polygon points="-7,-8.5 7,-8.5 0,1" style={{ fill: "var(--panel)", stroke, strokeWidth: 1.4 }} strokeLinejoin="round" />
      <rect x={-6} y={-10} width={12} height={3} style={{ fill: "var(--panel)" }} />
      {lines.map((l, i) => <text key={i} x={0} y={-h - 8 + 15 + i * 14} textAnchor="middle" fontSize="10.5" style={{ fill: "var(--text)" }}>{l}</text>)}
    </g>
  );
}

/** Look of each role: small, readable accessories so everyone is recognisable. */
type Look = { glasses?: boolean; headphones?: boolean; cap?: boolean; bun?: boolean; tie?: string; hoodie?: boolean; lanyard?: boolean; blazer?: boolean; star?: boolean };
const LOOKS: Record<string, Look> = {
  "chief-of-staff": { tie: "#d4a72c", blazer: true, star: true, headphones: true },
  cfo: { glasses: true, tie: "#1f9d6b" },
  "chartered-accountant": { glasses: true, tie: "#8a5cf5" },
  "company-secretary": { bun: true, blazer: true, glasses: true },
  cto: { hoodie: true, headphones: true },
  "marketing-growth": { cap: true },
  "product-manager": { lanyard: true },
};

function Person({ i, color, working, size = 1, slug = "" }: { i: number; color: string; working: boolean; size?: number; slug?: string }) {
  const look = LOOKS[slug] ?? {};
  const long = i % 2 === 1 && !look.bun && !look.cap;
  const hair = HAIR[i % HAIR.length];
  return (
    <g transform={`scale(${size})`} className={working ? "person-working" : "person-idle"}>
      {/* body */}
      <rect x={-17} y={-36} width={34} height={38} rx={15} style={{ fill: color }} />
      {look.hoodie && <path d="M-12,-36 q12,12 24,0 q-12,-3 -24,0 z" style={{ fill: "rgba(0,0,0,.28)" }} />}
      {look.blazer && <><path d="M-17,-30 l10,32 h-10 z" style={{ fill: "rgba(0,0,0,.22)" }} /><path d="M17,-30 l-10,32 h10 z" style={{ fill: "rgba(0,0,0,.22)" }} /><path d="M-6,-34 l6,16 l6,-16 z" fill="#f4f6ff" /></>}
      {look.tie && <path d="M0,-33 l-3.5,5 l3.5,16 l3.5,-16 z" fill={look.tie} />}
      {look.lanyard && <><path d="M-6,-36 l6,18 l6,-18" stroke="#ff7a90" strokeWidth={1.6} fill="none" /><rect x={-5} y={-19} width={10} height={12} rx={2} fill="#fff" stroke="#ff7a90" strokeWidth={1} /><rect x={-3} y={-17} width={6} height={3} rx={1} fill="#ff7a90" /></>}
      {look.star && <path d="M12,-24 l1.6,3.4 l3.7,.4 l-2.8,2.5 l.8,3.6 l-3.3,-1.9 l-3.3,1.9 l.8,-3.6 l-2.8,-2.5 l3.7,-.4 z" fill="#ffd34d" />}
      {/* head */}
      <g className="head">
        <circle cx={0} cy={-50} r={14} style={{ fill: SKIN[i % SKIN.length] }} />
        {look.bun && <circle cx={0} cy={-67} r={6} style={{ fill: hair }} />}
        {long
          ? <path d="M-15,-50 a15,15 0 0 1 30,0 v14 a6,6 0 0 1 -6,6 v-12 h-18 v12 a6,6 0 0 1 -6,-6 z" style={{ fill: hair }} />
          : <path d="M-15,-52 a15,15 0 0 1 30,0 q-8,-7 -30,0 z" style={{ fill: hair }} />}
        {look.cap && <><path d="M-15,-54 a15,15 0 0 1 30,0 z" style={{ fill: color }} stroke="rgba(0,0,0,.35)" strokeWidth={1} /><rect x={-3} y={-56} width={20} height={4} rx={2} style={{ fill: color }} stroke="rgba(0,0,0,.35)" strokeWidth={1} /></>}
        {look.headphones && <><path d="M-15,-50 a15,15 0 0 1 30,0" stroke="#e9eeff" strokeWidth={2.6} fill="none" /><rect x={-19} y={-53} width={6} height={10} rx={3} fill="#e9eeff" /><rect x={13} y={-53} width={6} height={10} rx={3} fill="#e9eeff" /></>}
        <g className="eyes"><circle cx={-5} cy={-49} r={1.8} fill="#1b1b24" /><circle cx={5} cy={-49} r={1.8} fill="#1b1b24" /></g>
        <circle cx={-9} cy={-44} r={2.4} fill="#ff8aa0" opacity={0.45} /><circle cx={9} cy={-44} r={2.4} fill="#ff8aa0" opacity={0.45} />
        {look.glasses && <g stroke="#1b1b24" strokeWidth={1.2} fill="rgba(255,255,255,.12)"><circle cx={-5.5} cy={-49} r={4.4} /><circle cx={5.5} cy={-49} r={4.4} /><path d="M-1.2,-49 h2.4" fill="none" /></g>}
        <path d={working ? "M-4,-43.5 q4,3.5 8,0" : "M-3.5,-43.5 q3.5,2 7,0"} stroke="#1b1b24" strokeWidth={1.4} fill="none" strokeLinecap="round" />
      </g>
      {/* arms */}
      <g className="arms"><rect x={-24} y={-22} width={10} height={26} rx={5} style={{ fill: color }} className="arm-l" /><rect x={14} y={-22} width={10} height={26} rx={5} style={{ fill: color }} className="arm-r" /></g>
    </g>
  );
}

/** The sender's walking copy: starts at its own desk, walks to the target's desk, stays while the work is going on, then walks home. */
function Messenger({ a, b, going, gone, brief, idx, color, slug }: { a: { x: number; y: number }; b: { x: number; y: number }; going: boolean; gone: boolean; brief: string; idx: number; color: string; slug: string }) {
  const home = { x: a.x + 105, y: a.y + 20 };
  const dest = { x: b.x + (b.x >= a.x ? -105 : 105), y: b.y + 20 };
  const [out, setOut] = useState(false);
  const [moving, setMoving] = useState(false);
  useEffect(() => { const t = setTimeout(() => setOut(going), 120); return () => clearTimeout(t); }, [going]);
  useEffect(() => { if (!out && !going) return; setMoving(true); const t = setTimeout(() => setMoving(false), 1900); return () => clearTimeout(t); }, [out]); // eslint-disable-line react-hooks/exhaustive-deps
  const at = out ? dest : home;
  const toward = out ? dest.x - home.x : home.x - dest.x; // direction of travel
  const flip = toward < 0 ? -1 : 1;
  return (
    <g className="messenger" style={{ transform: `translate(${at.x}px,${at.y}px)`, opacity: gone ? 0 : 1 }}>
      <g className={moving ? "walking" : ""}>
        <g className="walk-bob"><g transform={`scale(${flip},1)`}>
          <g className="legs"><g className="leg-l"><rect x={-9} y={1} width={7} height={20} rx={3.5} style={{ fill: "var(--text)", opacity: 0.55 }} /><rect x={-11} y={19} width={11} height={5} rx={2.5} fill="#e9eeff" /></g><g className="leg-r"><rect x={2} y={1} width={7} height={20} rx={3.5} style={{ fill: "var(--text)", opacity: 0.55 }} /><rect x={0} y={19} width={11} height={5} rx={2.5} fill="#e9eeff" /></g></g>
          <Person i={0} color={color} working={false} size={0.62} slug={slug} />
        </g></g>
      </g>
      {out && !moving && going && <Bubble x={0} y={-50 - (idx % 2) * 44} text={brief || "Passing on a brief"} />}
    </g>
  );
}

/** Props on the desk that say what each role does. */
function Props({ slug, color }: { slug: string; color: string }) {
  const paper = "#f4f6ff";
  switch (slug) {
    case "cfo": return <g><rect x={46} y={12} width={22} height={30} rx={3} fill="#2a3358" stroke={color} strokeWidth={1} />{[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => <rect key={r * 3 + c} x={49 + c * 6.2} y={22 + r * 6.2} width={4.4} height={4.4} rx={1} fill={color} opacity={0.8} />))}<rect x={49} y={14.5} width={16} height={5} rx={1} fill="#0b1020" /><circle cx={-60} cy={40} r={5} fill="#ffd34d" /><circle cx={-60} cy={36} r={5} fill="#ffc21a" /></g>;
    case "chartered-accountant": return <g><rect x={44} y={14} width={26} height={30} rx={2} fill="#7a4fd8" /><rect x={47} y={14} width={20} height={30} rx={2} fill={paper} /><path d="M50,22 h14 M50,28 h14 M50,34 h9" stroke="#8a93b8" strokeWidth={1.2} /><circle cx={-58} cy={36} r={8} fill="none" stroke="#e5484d" strokeWidth={1.6} opacity={0.8} /><text x={-58} y={39} textAnchor="middle" fontSize="7" fill="#e5484d" fontWeight={700}>OK</text></g>;
    case "company-secretary": return <g><rect x={46} y={10} width={22} height={32} rx={3} fill="#c8a45a" /><rect x={49} y={14} width={16} height={26} rx={1.5} fill={paper} /><rect x={53} y={8} width={8} height={5} rx={1.5} fill="#8a6a22" /><path d="M52,22 h10 M52,27 h10 M52,32 h6" stroke="#8a93b8" strokeWidth={1.1} /><rect x={-66} y={32} width={14} height={10} rx={1.5} fill="#ffb454" /><rect x={-64} y={29} width={6} height={4} rx={1} fill="#ffb454" /></g>;
    case "cto": return <g><rect x={44} y={6} width={30} height={22} rx={3} fill="#080c1a" stroke={color} strokeWidth={1.2} /><text x={59} y={21} textAnchor="middle" fontSize="11" fill={color} fontWeight={700}>{"</>"}</text><rect x={56} y={28} width={6} height={6} fill="#2a3358" /><rect x={-64} y={28} width={9} height={16} rx={2.5} fill="#2fe08a" /><rect x={-64} y={32} width={9} height={4} fill="#fff" opacity={0.6} /></g>;
    case "marketing-growth": return <g><path d="M46,22 l16,-9 v24 l-16,-9 z" fill="#ff7a90" /><rect x={42} y={19} width={7} height={8} rx={1.5} fill="#d94f6a" /><path d="M66,18 q5,4 0,8 M70,15 q8,7 0,14" stroke="#ff7a90" strokeWidth={1.4} fill="none" strokeLinecap="round" /><rect x={-68} y={30} width={11} height={11} fill="#ffe66d" transform="rotate(-6 -62 36)" /><rect x={-60} y={34} width={11} height={11} fill="#8ae8ff" transform="rotate(5 -55 40)" /></g>;
    case "product-manager": return <g><rect x={42} y={8} width={30} height={26} rx={2} fill="#101a36" stroke="#8aa0ff" strokeWidth={1} />{[[45, 12, "#ffe66d"], [57, 12, "#8ae8ff"], [45, 22, "#ff9ec4"], [57, 22, "#b6f2a0"]].map(([x, y, c], k) => <rect key={k} x={x as number} y={y as number} width={10} height={8} rx={1} fill={c as string} />)}<path d="M-66,30 l8,6 l12,-10" stroke="#2fe08a" strokeWidth={2.4} fill="none" strokeLinecap="round" /></g>;
    default: return <g><rect x={-70} y={32} width={26} height={10} rx={2} fill="#d4a72c" /><text x={-57} y={40} textAnchor="middle" fontSize="6.5" fill="#201a05" fontWeight={700}>CHIEF</text><path d="M56,12 v-12 l10,4 l-10,4" fill="#ffd34d" stroke="#ffd34d" strokeWidth={1} /><rect x={55} y={12} width={2} height={28} fill="#c8cde8" /></g>;
  }
}

function Desk({ x, y, i, r, working, note, boss, onBubble }: { x: number; y: number; i: number; r: Rost; working: boolean; note: string; boss: boolean; onBubble?: string }) {
  const color = COLORS[hash(r.slug) % COLORS.length];
  const s = boss ? 1.15 : 1;
  const confetti = ["#34e0f5", "#ffd34d", "#ff7a90", "#5fe3a1", "#b79bff", "#ffb454"];
  return (
    <g transform={`translate(${x},${y})`}>
      <ellipse cx={0} cy={58 * s} rx={96 * s} ry={13} style={{ fill: "var(--glow)" }} opacity={0.5} />
      <g transform={`translate(0,${-4}) scale(${s})`}>
        <Person i={i} color={color} working={working} slug={r.slug} />
        <rect x={-74} y={4} width={148} height={48} rx={9} style={{ fill: "var(--panel)", stroke: working ? color : "var(--border)", strokeWidth: working ? 1.8 : 1 }} className={working ? "desk-glow" : ""} />
        <rect x={-24} y={10} width={48} height={28} rx={4} fill="#080c1a" stroke={color} strokeWidth={1.2} />
        {working
          ? <g className="screen-lines">{[16, 22, 28].map((yy, k) => <rect key={k} x={-17} y={yy} width={26 + k * 5} height={2.6} rx={1.3} fill={color} className={`line l${k}`} />)}</g>
          : <rect x={-17} y={22} width={14} height={2.6} rx={1.3} fill={color} opacity={0.35} />}
        <rect x={-30} y={40} width={60} height={5} rx={2.5} style={{ fill: "var(--border)" }} />
        <Props slug={r.slug} color={color} />
        {/* coffee mug with steam */}
        <g transform="translate(-44,14)"><rect x={0} y={0} width={11} height={12} rx={2.5} fill="#f4f6ff" /><path d="M11,3 q5,1 0,7" stroke="#f4f6ff" strokeWidth={1.8} fill="none" /><rect x={1.5} y={1.5} width={8} height={3} fill="#6b3f26" />
          <path className="steam s1" d="M3,-2 q-3,-4 0,-7" stroke="#cfd6ff" strokeWidth={1.3} fill="none" strokeLinecap="round" /><path className="steam s2" d="M7,-2 q3,-4 0,-7" stroke="#cfd6ff" strokeWidth={1.3} fill="none" strokeLinecap="round" /></g>
      </g>
      {working && <g transform={`translate(${34 * s},${-70 * s})`} className="think" aria-hidden="true"><circle cx={-8} cy={10} r={2} style={{ fill: color }} /><circle cx={-2} cy={4} r={3} style={{ fill: color }} /><rect x={2} y={-14} width={38} height={20} rx={10} style={{ fill: "var(--panel)", stroke: color, strokeWidth: 1.2 }} />{[0, 1, 2].map((k) => <circle key={k} className={`dot d${k}`} cx={14 + k * 9} cy={-4} r={2.4} style={{ fill: color }} />)}</g>}
      <text x={0} y={(72) * s} textAnchor="middle" fontSize={boss ? 13 : 12} fontWeight={600} style={{ fill: "var(--text)" }}>{boss ? "★ " : ""}{r.name.split(" & ")[0].replace(/ Advisor$/, "")}</text>
      <text x={0} y={(72) * s + 14} textAnchor="middle" fontSize="10" style={{ fill: working ? color : "var(--muted)" }}>{working ? short(note || "Working", 34) : "At their desk"}</text>
      {onBubble && <><g className="confetti" aria-hidden="true">{confetti.map((c, k) => <rect key={k} className={`cf c${k}`} x={-50 + k * 20} y={-100 * s} width={5} height={8} rx={1.5} fill={c} />)}</g><Bubble x={0} y={-82 * s} text={onBubble} tone="done" /></>}
    </g>
  );
}

export default function OfficeScene({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<Activity | null>(null);
  const [err, setErr] = useState(false);
  const [demo, setDemo] = useState(false);
  const [t, setT] = useState(0);
  const doneAt = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try { const r = await fetch("/api/office", { cache: "no-store" }); if (!r.ok) throw new Error(); const j = await r.json(); if (!stop) { setData(j); setErr(false); } } catch { if (!stop) setErr(true); }
    };
    tick(); const h = setInterval(tick, 1500);
    return () => { stop = true; clearInterval(h); };
  }, []);
  useEffect(() => { if (!demo) return; setT(0); const h = setInterval(() => setT((x) => x + 0.5), 500); return () => clearInterval(h); }, [demo]);

  const roster = data?.roster ?? [];
  const chief = roster.find((r) => r.slug === "chief-of-staff");
  const staff = roster.filter((r) => r.slug !== "chief-of-staff");
  const pos = useMemo(() => {
    const p: Record<string, { x: number; y: number }> = {};
    if (chief) p[chief.slug] = { x: W / 2, y: 120 };
    staff.forEach((r, k) => { const row = Math.floor(k / COLS); const inRow = Math.min(COLS, staff.length - row * COLS); const col = k % COLS; p[r.slug] = { x: W / 2 + (col - (inRow - 1) / 2) * DX, y: 330 + row * ROW_H }; });
    return p;
  }, [chief, staff.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const H = 330 + Math.max(1, Math.ceil(staff.length / COLS)) * ROW_H - 40;

  // Demo: a scripted, clearly labelled meeting. Never mixed with real activity.
  const demoTalks: Talk[] = useMemo(() => {
    if (!demo || staff.length < 2) return [];
    const [a, b] = [staff.find((s) => s.slug === "cfo") ?? staff[0], staff.find((s) => s.slug === "chartered-accountant") ?? staff[1]];
    const L: Talk[] = [];
    if (t >= 1) L.push({ id: "d1", from: "chief-of-staff", to: a.slug, brief: "Demo: how long does our cash last?", status: t >= 7 ? "done" : "working", result: "Demo answer: about 14 months." });
    if (t >= 3) L.push({ id: "d2", from: "chief-of-staff", to: b.slug, brief: "Demo: any GST impact?", status: t >= 9 ? "done" : "working", result: "Demo answer: none this month." });
    return L;
  }, [demo, t, staff]);
  const demoAgents: Activity["agents"] = useMemo(() => {
    if (!demo) return {};
    const a: Activity["agents"] = {};
    if (t < 12) a["chief-of-staff"] = { state: "working", note: t < 9 ? "Briefing the team" : "Writing the answer" };
    for (const d of demoTalks) if (d.status === "working") a[d.to] = { state: "working", note: "Working on the brief" };
    return a;
  }, [demo, t, demoTalks]);
  useEffect(() => { if (demo && t > 14) setDemo(false); }, [demo, t]);

  const talks = demo ? demoTalks : data?.talks ?? [];
  const agents = demo ? demoAgents : data?.agents ?? {};
  const now = Date.now();
  for (const k of talks) { if (k.status === "done" && !doneAt.current.has(k.id)) doneAt.current.set(k.id, now); }
  const recentDone = (id: string) => { const d = doneAt.current.get(id); return d !== undefined && now - d < 9000; };
  const busy = Object.values(agents).some((a) => a.state === "working");

  return (
    <div className="card p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <span className="status-pill" role="status"><span className={`status-dot ${busy || demo ? "" : "off"}`} style={!busy && !demo ? { background: "var(--muted)", boxShadow: "none", animation: "none" } : undefined} />
          {demo ? "DEMO: simulated meeting, not real activity" : busy ? "The team is working" : err ? "Could not read activity" : "All quiet: nobody is working right now"}</span>
        <button className="btn" onClick={() => setDemo((d) => !d)} disabled={staff.length < 2} aria-pressed={demo}>{demo ? <><Square size={14} />Stop demo</> : <><Play size={14} />Play demo meeting</>}</button>
      </div>
      {!roster.length ? <p className="text-muted text-sm p-6">Loading the team…</p> : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Illustration of the AI team at their desks. Activity is described in the text below.">
          <defs><pattern id="floor" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" style={{ stroke: "var(--border)" }} strokeWidth="0.6" opacity="0.5" /></pattern></defs>
          <rect x={0} y={0} width={W} height={H} rx={18} fill="url(#floor)" opacity={0.7} />
          {chief && pos[chief.slug] && <text x={W / 2} y={28} textAnchor="middle" fontSize="11" letterSpacing="3" style={{ fill: "var(--muted)" }}>MANAGEMENT</text>}
          {chief && pos[chief.slug] && <Desk x={pos[chief.slug].x} y={pos[chief.slug].y} i={0} r={chief} boss working={agents[chief.slug]?.state === "working"} note={agents[chief.slug]?.note ?? ""} />}
          {staff.map((r, k) => { const p = pos[r.slug]; if (!p) return null;
            const doneTalk = talks.find((x) => x.to === r.slug && x.status === "done" && recentDone(x.id));
            return <Desk key={r.slug} x={p.x} y={p.y} i={k + 1} r={r} boss={false} working={agents[r.slug]?.state === "working"} note={agents[r.slug]?.note ?? ""} onBubble={doneTalk ? "✓ " + (doneTalk.result || "Done") : undefined} />; })}
          {talks.map((k, idx) => {
            const a = pos[k.from], b = pos[k.to]; if (!a || !b) return null;
            return <Messenger key={k.id} a={a} b={b} going={k.status === "working"} gone={k.status !== "working" && !recentDone(k.id)} brief={k.brief} idx={idx} color={COLORS[hash(k.from) % COLORS.length]} slug={k.from} />;
          })}
        </svg>)}
      <ul className="sr-only" aria-live="polite">{talks.map((k) => <li key={k.id}>{k.from} {k.status === "working" ? "is briefing" : "finished briefing"} {k.to}: {k.brief}</li>)}</ul>
      {!compact && !busy && !demo && !err && roster.length > 0 && <p className="text-muted text-xs mt-2">Start a chat with the Chief of Staff and ask something that needs the team (for example "have the CFO and the Chartered Accountant review our costs"): you will see the Chief walk over to each specialist here.</p>}
    </div>
  );
}
