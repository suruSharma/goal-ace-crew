-- Rename challenge_templates to challenges
ALTER TABLE public.challenge_templates RENAME TO challenges;

-- Update RLS policy names to reflect the new table name
-- (policies are automatically renamed with the table)