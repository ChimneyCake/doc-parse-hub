import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { matter_id } = await req.json();
    
    if (!matter_id) {
      return new Response(JSON.stringify({ error: "matter_id required" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: docRow } = await supabase
      .from("documents")
      .select("*")
      .eq("matter_id", matter_id)
      .eq("type", "office_action")
      .single();

    // Re-fetch file and re-run DocAI
    const { data: fileData, error: fileError } = await supabase.storage
      .from('documents')
      .download(docRow.path);
    
    if (fileError) throw new Error(`File fetch failed: ${fileError.message}`);
    const pdfBytes = new Uint8Array(await fileData.arrayBuffer());

    const doc = await processWithDocAI(pdfBytes);
    const fullText = doc.document?.text || "";

    await supabase
      .from("documents")
      .update({ text: fullText })
      .eq("id", docRow.id);

    return new Response(JSON.stringify({ status: "reparsed" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    console.error("Cleanup OCR error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
