-- Add completion_shown column to track if user has seen the completion popup
ALTER TABLE public.user_challenges ADD COLUMN completion_shown BOOLEAN NOT NULL DEFAULT false;