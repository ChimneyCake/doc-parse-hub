import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const extractTextFromPDF = async (pdfBytes: Uint8Array): Promise<string> => {
  // Simple text extraction - in production, you'd use a proper PDF parser
  // For now, we'll convert to base64 and use AI to extract text
  const base64 = btoa(String.fromCharCode(...pdfBytes));
  return base64;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_id, jurisdiction, title } = await req.json();
    if (!file_id) {
      return new Response(JSON.stringify({ error: "file_id required" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1) Fetch file from storage
    const { data: fileData, error: fileError } = await supabase.storage
      .from('documents')
      .download(file_id);
    
    if (fileError) throw new Error(`File fetch failed: ${fileError.message}`);
    const pdfBytes = new Uint8Array(await fileData.arrayBuffer());

    // 2) Convert PDF to base64 for AI processing
    const base64PDF = btoa(String.fromCharCode(...pdfBytes));

    // 3) Extract structured data using Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const system = `You are a legal NLP parser for USPTO office actions. Extract information from the PDF and output strict JSON with these fields:
metadata: {application_number: string, examiner: string, art_unit: string, mail_date: string}
rejections: [{code: string, basis: string, claims: string[], summary: string}]
formalities: [{topic: string, detail: string}]
claims: [{no: number, text: string}]
prior_art: [{kind: string, number: string, title: string}]

Use empty strings/arrays if information is not found. Do not invent data.`;

    const extractResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { 
            role: "user", 
            content: `Please analyze this USPTO office action PDF and extract the required information. The PDF is provided as base64: ${base64PDF.slice(0, 100000)}` 
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!extractResp.ok) {
      const errorText = await extractResp.text();
      throw new Error(`AI extraction failed: ${errorText}`);
    }

    const extractData = await extractResp.json();
    const extracted = JSON.parse(extractData.choices[0].message.content || "{}");

    // 4) Save to database
    const { data: matter } = await supabase.from("matters")
      .insert([{ title, jurisdiction, status: "parsed" }])
      .select()
      .single();

    await supabase.from("documents").insert([{
      matter_id: matter.id, 
      type: "office_action", 
      path: file_id, 
      text: base64PDF.slice(0, 50000)
    }]);

    await supabase.from("extraction").insert([{
      matter_id: matter.id,
      metadata: extracted.metadata || {},
      rejections: extracted.rejections || [],
      claims: extracted.claims || [],
      prior_art: extracted.prior_art || []
    }]);

    return new Response(JSON.stringify({ 
      matter_id: matter.id, 
      status: "parsed" 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    console.error("Ingest error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
