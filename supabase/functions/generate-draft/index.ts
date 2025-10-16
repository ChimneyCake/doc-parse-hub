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

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    });

    // Verify user authentication and matter access
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify matter ownership (RLS will handle this, but explicit check is good)
    const { data: matter, error: matterError } = await supabase
      .from("matters")
      .select("id")
      .eq("id", matter_id)
      .single();

    if (matterError || !matter) {
      return new Response(JSON.stringify({ error: "Matter not found or access denied" }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const system = `You draft patent office action responses compliant with ${jurisdiction} practice.
Tone: conservative, professional. 
Structure: ${sections.join(" -> ")}.
Cite ${jurisdiction === "EPO" ? "EPO Guidelines" : "MPEP"} with section numbers where relevant.
Do NOT assert facts not in record. Propose claim amendments only if helpful and explain the rationale. 
Output JSON with keys: outline (markdown string), arguments (array of {target,text}), amendments (array of {claim,proposed,rationale}), citations (array of {source,link}).`;

    const userPrompt = JSON.stringify({ rejections, claims, prior_art, style });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      throw new Error(`AI generation failed: ${errorText}`);
    }

    const respData = await resp.json();
    const draft = JSON.parse(respData.choices[0].message.content || "{}");

    // Save draft with user_id
    await supabase.from("drafts").insert([{
      matter_id,
      outline: draft.outline || "",
      arguments: draft.arguments || [],
      amendments: draft.amendments || [],
      citations: draft.citations || [],
      version: 1,
      user_id: user.id
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
