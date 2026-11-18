import { spawn, type ChildProcess } from "node:child_process";
import { chatTurn } from "./chat.ts";
import type { Attachment } from "./uploads.ts";

/**
 * A chat turn runs as a server-side job, independent of the browser page that started it.
 * Leaving the page (or closing the tab) does NOT cancel the agent; the answer is still saved
 * to the conversation. A page that comes back re-attaches: it replays the events so far and then
 * follows live. Only an explicit Stop cancels a job. Jobs live in memory: an app restart ends them
 * (the user's message is already saved, and the next message resumes the stored session).
 */
type Ev = Record<string, unknown>;
type Job = { events: Ev[]; done: boolean; wake: Set<() => void>; ac: AbortController };

const g = globalThis as unknown as { __jobs?: Map<string, Job> };
const jobs = (g.__jobs ??= new Map<string, Job>());

/**
 * While any agent is working, ask macOS not to go to idle sleep (caffeinate -i, and -s on mains power).
 * The display may still sleep. Closing the lid or choosing Sleep cannot be prevented; the page reconnects after wake.
 */
const gc = globalThis as unknown as { __caff?: ChildProcess | null };
let active = 0;
function keepAwake(on: boolean) {
  if (process.platform !== "darwin") return;
  active = Math.max(0, active + (on ? 1 : -1));
  if (active > 0 && !gc.__caff) {
    try { gc.__caff = spawn("/usr/bin/caffeinate", ["-i", "-s"], { stdio: "ignore" }); gc.__caff.on("exit", () => { gc.__caff = null; }); gc.__caff.unref(); } catch { gc.__caff = null; }
  } else if (active === 0 && gc.__caff) { gc.__caff.kill(); gc.__caff = null; }
}

export const getJob = (cid: string) => jobs.get(cid);
export const listJobs = () => [...jobs.entries()].map(([cid, j]) => ({ cid, done: j.done, events: j.events }));
export const isRunning = (cid: string) => !!jobs.get(cid) && !jobs.get(cid)!.done;

export function startJob(cid: string, prompt: string, approved?: { approvalId: string; hash: string; userNote: string }, attach?: { files: Attachment[]; saveToDrive: boolean }): Job {
  const job: Job = { events: [], done: false, wake: new Set(), ac: new AbortController() };
  jobs.set(cid, job);
  const notify = () => job.wake.forEach((w) => w());
  keepAwake(true);
  (async () => {
    try {
      for await (const ev of chatTurn(cid, prompt, job.ac.signal, approved, attach)) { job.events.push(ev as Ev); notify(); }
    } catch (e) {
      job.events.push({ type: "error", message: String((e as Error).message) });
    } finally {
      job.done = true; notify(); keepAwake(false);
      setTimeout(() => { if (jobs.get(cid) === job) jobs.delete(cid); }, 60_000).unref?.(); // keep briefly for late re-attach
    }
  })();
  return job;
}

export function stopJob(cid: string): boolean {
  const j = jobs.get(cid);
  if (!j || j.done) return false;
  j.ac.abort();
  return true;
}

/** NDJSON stream of a job from its first event. Closing the stream (page left) does not stop the job. */
export function streamJob(job: Job): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let i = 0;
  let waker: (() => void) | null = null;
  return new ReadableStream({
    async pull(controller) {
      for (;;) {
        if (i < job.events.length) { controller.enqueue(enc.encode(JSON.stringify(job.events[i++]) + "\n")); return; }
        if (job.done) { controller.close(); return; }
        await new Promise<void>((r) => { waker = r; job.wake.add(r); });
        if (waker) job.wake.delete(waker);
      }
    },
    cancel() { if (waker) job.wake.delete(waker); },
  });
}
