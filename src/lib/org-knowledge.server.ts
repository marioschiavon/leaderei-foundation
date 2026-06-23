// Loads the org-level knowledge bundle (instructions, highlights, items, site)
// for injection into AI prompts. Server-only.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchWebsiteContent } from "@/lib/website-scraper.server";
import type { OrgKnowledge } from "@/lib/ai-prompt-builder.server";

export async function loadOrgKnowledge(organizationId: string): Promise<OrgKnowledge> {
  const [profileRes, itemsRes] = await Promise.all([
    supabaseAdmin
      .from("ai_org_profile")
      .select("ai_instructions, highlights, website_url")
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabaseAdmin
      .from("knowledge_sources")
      .select("title, name, content, kind")
      .eq("organization_id", organizationId)
      .neq("status", "error")
      .not("content", "is", null)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const websiteUrl = (profileRes.data as any)?.website_url as string | null | undefined;
  const orgWebsiteContent = websiteUrl ? await fetchWebsiteContent(websiteUrl) : null;

  const items =
    (itemsRes.data ?? [])
      .filter((i: any) => i.content && String(i.content).trim())
      .map((i: any) => ({
        title: (i.title || i.name || "Item") as string,
        content: i.content as string,
        kind: i.kind as string,
      }));

  return {
    ai_instructions: (profileRes.data as any)?.ai_instructions ?? null,
    highlights: (profileRes.data as any)?.highlights ?? null,
    items,
    org_website_content: orgWebsiteContent,
  };
}
