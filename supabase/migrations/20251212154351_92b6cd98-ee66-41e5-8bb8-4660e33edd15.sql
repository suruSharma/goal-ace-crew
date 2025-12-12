-- Add quote_id column as FK to quotes table
ALTER TABLE public.favorite_quotes 
ADD COLUMN quote_id uuid REFERENCES public.quotes(id) ON DELETE CASCADE;

-- Drop the old text columns (they're now redundant)
ALTER TABLE public.favorite_quotes 
DROP COLUMN quote_text,
DROP COLUMN quote_author;

-- Add unique constraint to prevent duplicate favorites
ALTER TABLE public.favorite_quotes 
ADD CONSTRAINT unique_user_quote UNIQUE (user_id, quote_id);

-- Make quote_id NOT NULL after adding it
ALTER TABLE public.favorite_quotes 
ALTER COLUMN quote_id SET NOT NULL;