import "server-only";

import { ContentDepth, type ContentDepth as Depth } from "@/lib/schema";
import { getPreferencesOrDefault } from "@/services/preferences";

/** `?depth=` overrides the saved preference for this view only. */
export async function resolveDepth(param: string | string[] | undefined): Promise<Depth> {
  const parsed = ContentDepth.safeParse(Array.isArray(param) ? param[0] : param);
  if (parsed.success) return parsed.data;
  return (await getPreferencesOrDefault()).depth;
}
