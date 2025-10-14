import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Upload, FileCheck, Settings } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Patent Office Action Response Assistant</h1>
            <p className="text-xl text-muted-foreground">
              AI-powered tool for drafting patent office action responses
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/upload')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload Office Action
                </CardTitle>
                <CardDescription>
                  Upload a PDF office action for OCR and extraction
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full">Get Started</Button>
              </CardContent>
            </Card>

            <Card className="opacity-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  View Matters
                </CardTitle>
                <CardDescription>
                  Browse and manage your patent matters
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline" disabled>Coming Soon</Button>
              </CardContent>
            </Card>
          </div>

          <div className="bg-muted p-6 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4">How it works</h2>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">1</div>
                <div>
                  <h3 className="font-semibold">Upload Document</h3>
                  <p className="text-sm text-muted-foreground">Upload your office action PDF for processing</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">2</div>
                <div>
                  <h3 className="font-semibold">Review Extraction</h3>
                  <p className="text-sm text-muted-foreground">AI extracts rejections, claims, and prior art automatically</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">3</div>
                <div>
                  <h3 className="font-semibold">Generate Draft</h3>
                  <p className="text-sm text-muted-foreground">Create professional response with arguments and amendments</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">4</div>
                <div>
                  <h3 className="font-semibold">Export & File</h3>
                  <p className="text-sm text-muted-foreground">Export your response as DOCX or PDF</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
