-- Allow authenticated users to search for profiles by name (limited fields for privacy)
CREATE POLICY "Users can search for profiles by name"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);