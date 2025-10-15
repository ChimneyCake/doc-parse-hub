import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, Home } from "lucide-react";

export const Header = () => {
  const navigate = useNavigate();

  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <FileText className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Patent Response AI</span>
          </div>
          <nav className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <Home className="h-4 w-4 mr-2" />
              Home
            </Button>
            <Button variant="default" size="sm" onClick={() => navigate('/upload')}>
              New Matter
            </Button>
          </nav>
        </div>
      </div>
    </header>
  );
};
