import { isRunning } from "./jobs.ts";
import { stopConversationProcess } from "./claude.ts";
import { getConversation, deleteConversation } from "./store.ts";
import { removeConversationUploads } from "./uploads.ts";

/**
 * Deletes a conversation together with everything hanging off it: the warm Claude process, open approvals
 * (expired by deleteConversation) and the files attached to it. Refused while its agent is working, because
 * a late tool call could otherwise create an approval for a conversation that no longer exists, or the
 * attached file could vanish during an approved Drive upload.
 */
export function removeConversation(id: string): { ok: true } | { ok: false; status: number; error: string } {
  if (!getConversation(id)) return { ok: false, status: 404, error: "Not found" };
  if (isRunning(id)) return { ok: false, status: 409, error: "This conversation is still working. Stop it or wait for it to finish, then delete." };
  stopConversationProcess(id);
  deleteConversation(id);
  removeConversationUploads(id);
  return { ok: true };
}
