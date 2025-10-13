import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://deno.land/x/openai@v4.20.1/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const getAccessToken = async () => {
  const svc = JSON.parse(Deno.env.get("GOOGLE_APPLICATION_CREDENTIALS_JSON")!);
  const jwtHeader = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" })).replace(/=/g, '');
  const iat = Math.floor(Date.now()/1000);
  const exp = iat + 3600;
  const scope = "https://www.googleapis.com/auth/cloud-platform";
  const jwtClaimSet = btoa(JSON.stringify({
    iss: svc.client_email,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    exp, iat
  })).replace(/=/g, '');
  
  const encoder = new TextEncoder();
  const data = encoder.encode(`${jwtHeader}.${jwtClaimSet}`);
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    encoder.encode(svc.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, data);
  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer))).replace(/=/g, '');

  const assertion = `${jwtHeader}.${jwtClaimSet}.${signature}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ 
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", 
      assertion 
    })
  });
  const json = await res.json();
  return json.access_token as string;
};

const processWithDocAI = async (pdfBytes: Uint8Array) => {
  const projectId = Deno.env.get("GOOGLE_DOC_AI_PROJECT_ID")!;
  const location = Deno.env.get("GOOGLE_DOC_AI_LOCATION")!;
  const processorId = Deno.env.get("GOOGLE_DOC_AI_PROCESSOR_ID")!;
  const token = await getAccessToken();

  const url = `https://${location}-documentai.googleapis.com/v1/projects/${projectId}/locations/${location}/processors/${processorId}:process`;
  const res = await fetch(url, {
    method: "POST",
    headers: { 
      "Authorization": `Bearer ${token}`, 
      "Content-Type": "application/json" 
    },
    body: JSON.stringify({
      rawDocument: { 
        content: btoa(String.fromCharCode(...pdfBytes)), 
        mimeType: "application/pdf" 
      }
    })
  });
  if (!res.ok) throw new Error(`DocAI error ${res.status}: ${await res.text()}`);
  return res.json();
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

    // 2) OCR via DocAI
    const doc = await processWithDocAI(pdfBytes);
    const fullText = doc.document?.text || "";

    // 3) First-pass extraction with OpenAI
    const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY")! });
    const system = `You are a legal NLP parser for IP prosecution. Output strict JSON with fields:
metadata{application_number, examiner, art_unit, mail_date}, 
rejections[{code,basis,claims[],summary}], 
formalities[{topic,detail}], 
claims[{no,text}], 
prior_art[{kind,number,title}].
Do not invent text. Use empty strings/arrays if unknown.`;
    const user = fullText.slice(0, 120000);

    const extractResp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      response_format: { type: "json_object" }
    });

    const extracted = JSON.parse(extractResp.choices[0].message.content || "{}");

    // 4) Save to database
    const { data: matter } = await supabase.from("matters")
      .insert([{ title, jurisdiction, status: "parsed" }])
      .select()
      .single();

    await supabase.from("documents").insert([{
      matter_id: matter.id, 
      type: "office_action", 
      path: file_id, 
      text: fullText
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
