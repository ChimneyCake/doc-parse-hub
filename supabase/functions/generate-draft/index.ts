import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://deno.land/x/openai@v4.20.1/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      matter_id, 
      jurisdiction = "USPTO", 
      rejections = [], 
      claims = [], 
      prior_art = [], 
      style = "concise", 
      sections = ["cover","summary","amendments","arguments","conclusion"] 
    } = await req.json();

    if (!matter_id) {
      return new Response(JSON.stringify({ error: "matter_id required" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const system = `You draft patent office action responses compliant with ${jurisdiction} practice.
Tone: conservative, professional. 
Structure: ${sections.join(" -> ")}.
Cite ${jurisdiction === "EPO" ? "EPO Guidelines" : "MPEP"} with section numbers where relevant.
Do NOT assert facts not in record. Propose claim amendments only if helpful and explain the rationale. 
Output JSON with keys: outline (markdown string), arguments (array of {target,text}), amendments (array of {claim,proposed,rationale}), citations (array of {source,link}).`;

    const user = JSON.stringify({ rejections, claims, prior_art, style });

    const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY")! });
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      response_format: { type: "json_object" }
    });

    const draft = JSON.parse(resp.choices[0].message.content || "{}");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase.from("drafts").insert([{
      matter_id,
      outline: draft.outline || "",
      arguments: draft.arguments || [],
      amendments: draft.amendments || [],
      citations: draft.citations || [],
      version: 1
    }]);

    return new Response(JSON.stringify(draft), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    console.error("Generate draft error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
