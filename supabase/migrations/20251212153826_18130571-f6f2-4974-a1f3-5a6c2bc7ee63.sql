-- Allow users to delete their own profile
CREATE POLICY "Users can delete their own profile" 
ON public.profiles 
FOR DELETE 
USING (auth.uid() = id);

-- Allow users to delete their own challenge templates
CREATE POLICY "Users can delete their own challenge templates" 
ON public.challenge_templates 
FOR DELETE 
USING (auth.uid() = created_by);