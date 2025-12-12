-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  birthdate DATE,
  current_weight DECIMAL(5,2),
  goal_weight DECIMAL(5,2),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create groups table
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  invite_code TEXT UNIQUE DEFAULT substring(md5(random()::text), 1, 8),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create group_members junction table
CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Create challenge_templates for configurable tasks
CREATE TABLE public.challenge_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  weight INTEGER DEFAULT 1,
  is_default BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_challenges to track individual progress
CREATE TABLE public.user_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  current_day INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create daily_tasks for tracking task completion
CREATE TABLE public.daily_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_challenge_id UUID REFERENCES public.user_challenges(id) ON DELETE CASCADE NOT NULL,
  template_id UUID REFERENCES public.challenge_templates(id) ON DELETE CASCADE NOT NULL,
  day_number INTEGER NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_challenge_id, template_id, day_number)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Groups policies
CREATE POLICY "Anyone can view groups" ON public.groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create groups" ON public.groups FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Group creators can update their groups" ON public.groups FOR UPDATE USING (auth.uid() = created_by);

-- Group members policies
CREATE POLICY "Members can view group members" ON public.group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can join groups" ON public.group_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave groups" ON public.group_members FOR DELETE USING (auth.uid() = user_id);

-- Challenge templates policies
CREATE POLICY "Anyone can view default templates" ON public.challenge_templates FOR SELECT TO authenticated USING (is_default = true OR created_by = auth.uid() OR group_id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid()));
CREATE POLICY "Users can create templates" ON public.challenge_templates FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

-- User challenges policies
CREATE POLICY "Users can view own challenges" ON public.user_challenges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own challenges" ON public.user_challenges FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own challenges" ON public.user_challenges FOR UPDATE USING (auth.uid() = user_id);

-- Daily tasks policies
CREATE POLICY "Users can view own tasks" ON public.daily_tasks FOR SELECT USING (user_challenge_id IN (SELECT id FROM public.user_challenges WHERE user_id = auth.uid()));
CREATE POLICY "Users can create own tasks" ON public.daily_tasks FOR INSERT WITH CHECK (user_challenge_id IN (SELECT id FROM public.user_challenges WHERE user_id = auth.uid()));
CREATE POLICY "Users can update own tasks" ON public.daily_tasks FOR UPDATE USING (user_challenge_id IN (SELECT id FROM public.user_challenges WHERE user_id = auth.uid()));

-- Insert default 75 Hard tasks
INSERT INTO public.challenge_templates (name, description, weight, is_default) VALUES
  ('Workout 1 (45 min)', 'Complete a 45-minute workout', 2, true),
  ('Workout 2 - Outdoor (45 min)', 'Complete a 45-minute outdoor workout', 2, true),
  ('Follow a Diet', 'Follow your chosen diet with no cheat meals', 2, true),
  ('No Alcohol', 'No alcohol consumption', 1, true),
  ('Drink 1 Gallon of Water', 'Drink one gallon (3.8L) of water', 1, true),
  ('Read 10 Pages', 'Read 10 pages of a non-fiction book', 1, true),
  ('Progress Photo', 'Take a progress photo', 1, true);

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();