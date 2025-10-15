import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Download } from "lucide-react";
import { Header } from "@/components/Header";

export default function Draft() {
  const { matterId } = useParams();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<any>(null);

  const generateDraft = async () => {
    setGenerating(true);
    try {
      // First get extraction data
      const { data: extractionData, error: extractionError } = await supabase.functions.invoke('get-extraction', {
        method: 'GET',
        body: { matter_id: matterId }
      });

      if (extractionError) throw extractionError;

      // Generate draft
      const { data, error } = await supabase.functions.invoke('generate-draft', {
        body: {
          matter_id: matterId,
          jurisdiction: "USPTO",
          rejections: extractionData.rejections,
          claims: extractionData.claims,
          prior_art: extractionData.prior_art,
          style: "concise",
          sections: ["cover", "summary", "amendments", "arguments", "conclusion"]
        }
      });

      if (error) throw error;
      setDraft(data);
      toast({ title: "Success", description: "Draft generated successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('export-draft', {
        body: { matter_id: matterId, format: "txt" }
      });

      if (error) throw error;

      // Create download
      const blob = new Blob([data], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `OA_Response_${matterId}.txt`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({ title: "Success", description: "Draft exported" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  return (
    <>
      <Header />
      <div className="container max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Response Draft</h1>
        <div className="flex gap-2">
          {!draft && (
            <Button onClick={generateDraft} disabled={generating}>
              {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {generating ? "Generating..." : "Generate Draft"}
            </Button>
          )}
          {draft && (
            <Button onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          )}
        </div>
      </div>

      {draft && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Outline</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={draft.outline || ""}
                onChange={(e) => setDraft({ ...draft, outline: e.target.value })}
                className="min-h-[300px] font-mono text-sm"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Arguments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {draft.arguments?.map((arg: any, idx: number) => (
                <div key={idx} className="border-l-4 border-primary pl-4">
                  <p className="font-semibold">{arg.target}</p>
                  <p className="text-sm mt-2">{arg.text}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Proposed Amendments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {draft.amendments?.map((amend: any, idx: number) => (
                <div key={idx} className="space-y-2">
                  <p className="font-semibold">Claim {amend.claim}</p>
                  <p className="text-sm">{amend.proposed}</p>
                  <p className="text-sm text-muted-foreground italic">{amend.rationale}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Citations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {draft.citations?.map((cite: any, idx: number) => (
                <div key={idx} className="flex gap-2">
                  <span className="font-semibold">{cite.source}</span>
                  {cite.link && (
                    <a href={cite.link} className="text-primary underline" target="_blank" rel="noopener noreferrer">
                      {cite.link}
                    </a>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {!draft && !generating && (
        <div className="text-center text-muted-foreground py-12">
          Click "Generate Draft" to create a response draft
        </div>
      )}
    </div>
    </>
  );
}
