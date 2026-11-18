import { NextResponse, type NextRequest } from "next/server";
import { checkRequest } from "@/lib/security";

/** Runs before every API request: local host only, same-origin JSON only for state-changing calls. */
export function proxy(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    const err = checkRequest(req.method, req.headers);
    if (err) return NextResponse.json({ error: err }, { status: 403 });
  }
  return NextResponse.next();
}
export const config = { matcher: ["/api/:path*"] };
