import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/api-format";

/** Clears a session cookie the API no longer accepts, then sends the user to sign in. */
export async function GET() {
  // Relative Location: request.url inside the container is the bind address, not the browser's host.
  const response = new NextResponse(null, { status: 307, headers: { Location: "/login?expired=1" } });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
