import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Upload as UploadIcon } from "lucide-react";

export default function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [jurisdiction, setJurisdiction] = useState("USPTO");
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleProcess = async () => {
    if (!file || !title) {
      toast({ title: "Error", description: "Please provide a title and file", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    try {
      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const filePath = `${crypto.randomUUID()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Call ingest function
      const { data, error } = await supabase.functions.invoke('ingest', {
        body: { file_id: filePath, jurisdiction, title }
      });

      if (error) throw error;

      toast({ title: "Success", description: "Document processed successfully" });
      navigate(`/extraction/${data.matter_id}`);
    } catch (error: any) {
      console.error(error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="container max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Office Action</CardTitle>
          <CardDescription>Upload a PDF office action for processing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Matter Title</Label>
            <Input
              id="title"
              placeholder="Enter matter title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="jurisdiction">Jurisdiction</Label>
            <Select value={jurisdiction} onValueChange={setJurisdiction}>
              <SelectTrigger id="jurisdiction">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USPTO">USPTO</SelectItem>
                <SelectItem value="EPO">EPO</SelectItem>
                <SelectItem value="WIPO">WIPO</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">Office Action PDF</Label>
            <Input
              id="file"
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
            />
          </div>

          <Button 
            onClick={handleProcess} 
            disabled={isProcessing || !file || !title}
            className="w-full"
          >
            <UploadIcon className="mr-2 h-4 w-4" />
            {isProcessing ? "Processing..." : "Process Document"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
