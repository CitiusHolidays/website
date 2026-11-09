import { NextResponse } from "next/server";
import { withReturnPathHeader } from "@/lib/requestReturnPath";

// Hands the requested Staff Workspace path to the portal layout, so a signed-out visitor is sent
// back to that page after signing in. No auth decision is made here.
export function proxy(request) {
  return NextResponse.next({
    request: { headers: withReturnPathHeader(request.headers, request.url) },
  });
}

export const config = {
  matcher: ["/portal", "/portal/:path*"],
};
