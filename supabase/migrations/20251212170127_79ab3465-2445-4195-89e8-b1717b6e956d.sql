-- Add total_days column to groups table for custom challenge duration
ALTER TABLE public.groups ADD COLUMN total_days INTEGER NOT NULL DEFAULT 75;