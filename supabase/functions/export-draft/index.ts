import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { matter_id, format = "txt" } = await req.json();
    
    if (!matter_id) {
      return new Response(JSON.stringify({ error: "matter_id required" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: draft } = await supabase
      .from("drafts")
      .select("*")
      .eq("matter_id", matter_id)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    // Generate text format (DOCX would require additional library)
    let content = "OFFICE ACTION RESPONSE\n\n";
    content += "OUTLINE\n" + (draft.outline || "") + "\n\n";
    content += "ARGUMENTS\n";
    (draft.arguments || []).forEach((a: any) => {
      content += `- ${a.target}: ${a.text}\n`;
    });
    content += "\nPROPOSED AMENDMENTS\n";
    (draft.amendments || []).forEach((m: any) => {
      content += `Claim ${m.claim}: ${m.proposed} (Reason: ${m.rationale})\n`;
    });
    content += "\nCITATIONS\n";
    (draft.citations || []).forEach((c: any) => {
      content += `- ${c.source} — ${c.link || ""}\n`;
    });

    return new Response(content, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="OA_Response_${matter_id}.txt"`
      }
    });
  } catch (e: any) {
    console.error("Export error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
