import Link from "next/link";
import { listApprovals } from "@/lib/store";
import { ApprovalDecision, NewApproval } from "@/components/Actions";

export const dynamic = "force-dynamic";

export default function Approvals() {
  const items = listApprovals();
  return (
    <div className="space-y-6">
      <header><h1 className="text-2xl font-semibold">Approvals</h1>
        <p className="text-muted text-sm">Each approval covers exactly one recorded action, once. <b>Google Drive file creation is the one action the app can perform:</b> approve it in its chat (use the link on the card) and the file is uploaded once, exactly as shown. Every other approval (email, GitHub, deploy, payment, filing) only records your decision; the app has no way to carry those out, so you do them yourself.</p></header>
      <NewApproval />
      {items.length === 0 ? <p className="text-muted text-sm">No approval requests.</p> : items.map((a) => (
        <article key={a.id} className="card p-4">
          <div className="flex justify-between gap-2"><h2 className="font-medium">{a.title}</h2><span className="badge">{a.status}</span></div>
          <p className="text-xs text-muted">{a.kind} · requested {a.requested_at.slice(0, 16).replace("T", " ")}{a.agent && ` by ${a.agent}`} · payload {a.payload_hash.slice(0, 12)}</p>
          <pre className="mt-2 text-sm whitespace-pre-wrap bg-bg rounded-lg p-3">{a.details}</pre>
          {a.kind === "drive.create_file" && a.conversation_id && (a.status === "pending" || a.status === "approved") && <p className="mt-2 text-sm"><Link className="underline text-accent" href={`/conversations/${a.conversation_id}`}>Open the chat to approve and save to Drive</Link></p>}
          {a.status === "pending" ? <ApprovalDecision id={a.id} /> : <p className="text-xs text-muted mt-2">Decided {a.decided_at?.slice(0, 16).replace("T", " ")} {a.decision_note && `· ${a.decision_note}`}{a.consumed_at && ` · used ${a.consumed_at.slice(0, 16)}`}</p>}
        </article>))}
    </div>
  );
}
