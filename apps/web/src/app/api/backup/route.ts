import { ok, fail } from "@/lib/http";
import { backupNow } from "@/lib/store";

export async function POST() {
  try {
    return ok({ file: backupNow() });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}
