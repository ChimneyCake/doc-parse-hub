-- Create matters table
CREATE TABLE public.matters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  jurisdiction TEXT NOT NULL DEFAULT 'USPTO',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create documents table
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  path TEXT NOT NULL,
  text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create extraction table
CREATE TABLE public.extraction (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  metadata JSONB DEFAULT '{}'::jsonb,
  rejections JSONB DEFAULT '[]'::jsonb,
  formalities JSONB DEFAULT '[]'::jsonb,
  claims JSONB DEFAULT '[]'::jsonb,
  prior_art JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create drafts table
CREATE TABLE public.drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  outline TEXT DEFAULT '',
  arguments JSONB DEFAULT '[]'::jsonb,
  amendments JSONB DEFAULT '[]'::jsonb,
  citations JSONB DEFAULT '[]'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.matters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extraction ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;

-- Create policies (public access for MVP)
CREATE POLICY "Allow public read access on matters" ON public.matters FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on matters" ON public.matters FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on matters" ON public.matters FOR UPDATE USING (true);

CREATE POLICY "Allow public read access on documents" ON public.documents FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on documents" ON public.documents FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read access on extraction" ON public.extraction FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on extraction" ON public.extraction FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read access on drafts" ON public.drafts FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on drafts" ON public.drafts FOR INSERT WITH CHECK (true);

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

-- Create storage policies
CREATE POLICY "Allow public upload to documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documents');
CREATE POLICY "Allow public read from documents" ON storage.objects FOR SELECT USING (bucket_id = 'documents');

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates on matters
CREATE TRIGGER update_matters_updated_at
BEFORE UPDATE ON public.matters
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();