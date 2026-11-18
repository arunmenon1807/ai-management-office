import { notFound } from "next/navigation";
import Link from "next/link";
import { getConversation, getMessages, listApprovals } from "@/lib/store";
import { getAgent } from "@/lib/agents";
import { authStatus } from "@/lib/claude";
import Chat from "@/components/Chat";
import { ConversationControls } from "@/components/Actions";

export const dynamic = "force-dynamic";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = getConversation(id);
  if (!c) notFound();
  const agent = getAgent(c.agent);
  const auth = await authStatus();
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><Link href="/conversations" className="text-xs text-muted">← Conversations</Link>
          <h1 className="text-xl font-semibold">{c.title}</h1>
          <p className="text-xs text-muted">{agent?.name ?? c.agent} · {c.claude_session_id ? "session linked (resumes context)" : "no session yet"}{!agent && " · agent definition missing"}</p></div>
        <ConversationControls id={c.id} title={c.title} />
      </header>
      <Chat conversationId={c.id} agentName={agent?.name ?? c.agent} initial={getMessages(id)} aiReady={auth.loggedIn && !!agent && agent.status !== "error"} aiNote={!agent ? "agent definition is missing" : auth.detail} handoff={c.handoff} driveApprovals={listApprovals().filter((a) => a.conversation_id === id && a.kind === "drive.create_file")} />
    </div>
  );
}
