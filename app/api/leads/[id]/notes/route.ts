import type { NextRequest } from "next/server";
import { getContactNotes } from "@/lib/ghl";
import type { LeadNote } from "@/lib/leads";

const CONTACT_ID_RE = /^[A-Za-z0-9]{8,40}$/;

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Notes are fetched per lead on demand (when its row is opened) rather than in
// bulk on page load: GHL only exposes notes per contact, and fetching all of
// them at once hits its rate limit.
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/leads/[id]/notes">) {
  const { id } = await ctx.params;
  if (!CONTACT_ID_RE.test(id)) return Response.json({ error: "invalid id" }, { status: 400 });

  try {
    const notes = await getContactNotes(id);
    const body: LeadNote[] = notes
      .map((n) => ({ id: n.id, text: n.bodyText?.trim() || htmlToText(n.body ?? ""), dateAdded: n.dateAdded }))
      .filter((n) => n.text)
      .sort((a, b) => b.dateAdded.localeCompare(a.dateAdded));
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("notes fetch failed", err);
    return Response.json({ error: "upstream error" }, { status: 502 });
  }
}
