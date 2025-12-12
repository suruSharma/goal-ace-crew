-- Allow users to delete their own templates
CREATE POLICY "Users can delete their own templates"
ON public.challenge_templates
FOR DELETE
USING (auth.uid() = created_by);

-- Allow users to update their own templates
CREATE POLICY "Users can update their own templates"
ON public.challenge_templates
FOR UPDATE
USING (auth.uid() = created_by);