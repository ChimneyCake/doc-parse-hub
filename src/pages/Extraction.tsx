import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function Extraction() {
  const { matterId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [extraction, setExtraction] = useState<any>(null);

  useEffect(() => {
    fetchExtraction();
  }, [matterId]);

  const fetchExtraction = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-extraction', {
        method: 'GET',
        body: { matter_id: matterId }
      });

      if (error) throw error;
      setExtraction(data);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleContinueToDraft = () => {
    navigate(`/draft/${matterId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Extracted Data</h1>
        <Button onClick={handleContinueToDraft}>Continue to Draft</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="font-semibold">Application Number</dt>
              <dd>{extraction?.metadata?.application_number || "N/A"}</dd>
            </div>
            <div>
              <dt className="font-semibold">Examiner</dt>
              <dd>{extraction?.metadata?.examiner || "N/A"}</dd>
            </div>
            <div>
              <dt className="font-semibold">Art Unit</dt>
              <dd>{extraction?.metadata?.art_unit || "N/A"}</dd>
            </div>
            <div>
              <dt className="font-semibold">Mail Date</dt>
              <dd>{extraction?.metadata?.mail_date || "N/A"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rejections</CardTitle>
          <CardDescription>{extraction?.rejections?.length || 0} rejection(s) found</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {extraction?.rejections?.map((rej: any, idx: number) => (
            <div key={idx} className="border-l-4 border-destructive pl-4">
              <p className="font-semibold">{rej.code}</p>
              <p className="text-sm text-muted-foreground">{rej.basis}</p>
              <p className="text-sm">Claims: {rej.claims?.join(", ")}</p>
              <p className="text-sm mt-2">{rej.summary}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Claims</CardTitle>
          <CardDescription>{extraction?.claims?.length || 0} claim(s) found</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {extraction?.claims?.map((claim: any, idx: number) => (
            <div key={idx} className="border-b pb-2">
              <p className="font-semibold">Claim {claim.no}</p>
              <p className="text-sm">{claim.text}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prior Art</CardTitle>
          <CardDescription>{extraction?.prior_art?.length || 0} reference(s) found</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {extraction?.prior_art?.map((art: any, idx: number) => (
            <div key={idx} className="flex gap-4">
              <span className="font-mono text-sm">{art.kind}</span>
              <span className="font-semibold">{art.number}</span>
              <span className="text-sm">{art.title}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
