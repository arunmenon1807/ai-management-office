import { NextResponse } from "next/server";

export const ok = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

/** Parse a JSON object body or return a 400 response. */
export async function body<T = Record<string, unknown>>(req: Request): Promise<T | NextResponse> {
  try {
    const j = await req.json();
    if (!j || typeof j !== "object" || Array.isArray(j)) return fail("Body must be a JSON object");
    return j as T;
  } catch {
    return fail("Invalid JSON");
  }
}
export const isResp = (x: unknown): x is NextResponse => x instanceof NextResponse;
export const str = (v: unknown, max = 5000): string | undefined => (typeof v === "string" ? v.slice(0, max) : undefined);
