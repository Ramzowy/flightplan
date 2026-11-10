import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/api-format";

export default async function RootPage() {
  const store = await cookies();
  // Optimistic only; the protected layout verifies the session with the API.
  redirect(store.has(SESSION_COOKIE) ? "/dashboard" : "/welcome");
}
