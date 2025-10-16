-- Add user_id columns to all tables
ALTER TABLE public.matters ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.documents ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.drafts ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.extraction ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create profiles table for user data
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email)
  );
  
  -- Assign default 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'user');
  
  RETURN new;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Drop existing public policies
DROP POLICY IF EXISTS "Allow public read access on matters" ON public.matters;
DROP POLICY IF EXISTS "Allow public insert access on matters" ON public.matters;
DROP POLICY IF EXISTS "Allow public update access on matters" ON public.matters;
DROP POLICY IF EXISTS "Allow public read access on documents" ON public.documents;
DROP POLICY IF EXISTS "Allow public insert access on documents" ON public.documents;
DROP POLICY IF EXISTS "Allow public read access on drafts" ON public.drafts;
DROP POLICY IF EXISTS "Allow public insert access on drafts" ON public.drafts;
DROP POLICY IF EXISTS "Allow public read access on extraction" ON public.extraction;
DROP POLICY IF EXISTS "Allow public insert access on extraction" ON public.extraction;

-- RLS Policies for matters table
CREATE POLICY "Users can view their own matters"
  ON public.matters FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert their own matters"
  ON public.matters FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own matters"
  ON public.matters FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete matters"
  ON public.matters FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for documents table
CREATE POLICY "Users can view documents for their matters"
  ON public.documents FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR 
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.matters WHERE matters.id = documents.matter_id AND matters.user_id = auth.uid())
  );

CREATE POLICY "Users can insert documents for their matters"
  ON public.documents FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.matters WHERE matters.id = documents.matter_id AND matters.user_id = auth.uid())
  );

CREATE POLICY "Admins can update documents"
  ON public.documents FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete documents"
  ON public.documents FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for drafts table
CREATE POLICY "Users can view drafts for their matters"
  ON public.drafts FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR 
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.matters WHERE matters.id = drafts.matter_id AND matters.user_id = auth.uid())
  );

CREATE POLICY "Users can insert drafts for their matters"
  ON public.drafts FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.matters WHERE matters.id = drafts.matter_id AND matters.user_id = auth.uid())
  );

CREATE POLICY "Admins can update drafts"
  ON public.drafts FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete drafts"
  ON public.drafts FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for extraction table
CREATE POLICY "Users can view extraction for their matters"
  ON public.extraction FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR 
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.matters WHERE matters.id = extraction.matter_id AND matters.user_id = auth.uid())
  );

CREATE POLICY "Users can insert extraction for their matters"
  ON public.extraction FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.matters WHERE matters.id = extraction.matter_id AND matters.user_id = auth.uid())
  );

CREATE POLICY "Admins can update extraction"
  ON public.extraction FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete extraction"
  ON public.extraction FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for profiles table
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_roles table
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at on profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();