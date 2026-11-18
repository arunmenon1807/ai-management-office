/** Turns the events of the running (or just finished) chat jobs into "who is doing what" for the Office view. Real data only. */
export type Talk = { id: string; from: string; to: string; brief: string; status: "working" | "done"; result: string };
export type AgentState = { state: "idle" | "working"; note: string };
export type Activity = { agents: Record<string, AgentState>; talks: Talk[] };
type JobLike = { agent: string; done: boolean; events: Record<string, unknown>[] };

const one = (s: unknown, n = 140) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
/** A specialist's hand-back arrives wrapped in Claude Code's own framing; show only its findings, as plain text. */
export const plainResult = (s: unknown, n = 140) => one(String(s ?? "")
  .replace(/(<|&lt;)tools-used-before-summary(>|&gt;)[\s\S]*?(<|&lt;)\/tools-used-before-summary(>|&gt;)/gi, "")
  .replace(/\[Subagent hand-back\][^\n]*\n?/i, "")
  .replace(/^\s*[*#>_\s]*ADVISORY\b[^\n]*\n/i, "") // skip the standard disclaimer line so the bubble shows the answer
  .replace(/[*#|`>_~-]{1,}/g, " "), n);

export function deriveActivity(jobs: JobLike[]): Activity {
  const agents: Record<string, AgentState> = {};
  const talks: Talk[] = [];
  const mark = (slug: string, state: AgentState) => { if (!agents[slug] || state.state === "working") agents[slug] = state; };
  for (const j of jobs) {
    const live = !j.done;
    if (live) mark(j.agent, { state: "working", note: "Working on the founder's message" });
    const mine = new Map<string, Talk>();
    for (const ev of j.events) {
      if (ev.type !== "delegate") continue;
      const id = String(ev.id);
      if (ev.phase === "start") {
        const t: Talk = { id: `${j.agent}:${id}`, from: j.agent, to: String(ev.agent), brief: one(ev.brief), status: "working", result: "" };
        mine.set(id, t); talks.push(t);
      }
      const t = mine.get(id);
      if (!t) continue;
      if (ev.phase === "tool" && live && t.status === "working") mark(t.to, { state: "working", note: `Using ${one(ev.name, 40)}` });
      if (ev.phase === "end") { t.status = "done"; t.result = plainResult(ev.result); }
    }
    for (const t of mine.values()) if (t.status === "working" && live) mark(t.to, agents[t.to]?.state === "working" ? agents[t.to] : { state: "working", note: "Working on the brief" });
    // A job that ended can leave a delegation unfinished (stopped): show it as done rather than working forever.
    if (!live) for (const t of mine.values()) if (t.status === "working") t.status = "done";
  }
  return { agents, talks };
}
