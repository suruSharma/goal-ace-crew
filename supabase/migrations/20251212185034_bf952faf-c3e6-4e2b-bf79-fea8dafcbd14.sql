-- Change default color theme from purple to blue
ALTER TABLE public.profiles 
ALTER COLUMN color_theme SET DEFAULT 'blue';