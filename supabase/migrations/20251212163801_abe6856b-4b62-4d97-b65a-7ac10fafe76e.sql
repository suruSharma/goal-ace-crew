-- Create achievements table for badge definitions
CREATE TABLE public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,
  category text NOT NULL,
  requirement_type text NOT NULL,
  requirement_value integer NOT NULL,
  points integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Create user_achievements table for tracking unlocked badges
CREATE TABLE public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  achievement_id uuid NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

-- Enable RLS
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- Achievements are readable by everyone (they're just definitions)
CREATE POLICY "Anyone can view achievements"
ON public.achievements FOR SELECT
USING (true);

-- Users can view their own unlocked achievements
CREATE POLICY "Users can view their own achievements"
ON public.user_achievements FOR SELECT
USING (auth.uid() = user_id);

-- Users can unlock achievements for themselves
CREATE POLICY "Users can unlock achievements"
ON public.user_achievements FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Seed achievement definitions
INSERT INTO public.achievements (name, description, icon, category, requirement_type, requirement_value, points) VALUES
-- Streak achievements
('First Flame', 'Complete your first day', 'flame', 'streak', 'streak', 1, 10),
('Week Warrior', 'Maintain a 7-day streak', 'flame', 'streak', 'streak', 7, 50),
('Fortnight Fighter', 'Maintain a 14-day streak', 'flame', 'streak', 'streak', 14, 100),
('Monthly Master', 'Maintain a 30-day streak', 'flame', 'streak', 'streak', 30, 250),
('Streak Legend', 'Maintain a 50-day streak', 'crown', 'streak', 'streak', 50, 500),
('Unstoppable', 'Complete 75 days straight', 'trophy', 'streak', 'streak', 75, 1000),

-- Points achievements
('Point Starter', 'Earn 50 points', 'star', 'points', 'points', 50, 10),
('Century Club', 'Earn 100 points', 'star', 'points', 'points', 100, 25),
('Point Collector', 'Earn 500 points', 'gem', 'points', 'points', 500, 100),
('Point Master', 'Earn 1000 points', 'gem', 'points', 'points', 1000, 250),
('Point Legend', 'Earn 2500 points', 'sparkles', 'points', 'points', 2500, 500),

-- Tasks achievements
('Task Tackler', 'Complete 25 tasks', 'check-circle', 'tasks', 'tasks', 25, 25),
('Task Champion', 'Complete 100 tasks', 'check-circle', 'tasks', 'tasks', 100, 100),
('Task Machine', 'Complete 250 tasks', 'zap', 'tasks', 'tasks', 250, 250),
('Task Legend', 'Complete 500 tasks', 'rocket', 'tasks', 'tasks', 500, 500),

-- Challenge completion achievements
('Challenger', 'Complete your first challenge', 'award', 'challenge', 'challenges', 1, 500),
('Double Trouble', 'Complete 2 challenges', 'medal', 'challenge', 'challenges', 2, 750),
('Triple Threat', 'Complete 3 challenges', 'trophy', 'challenge', 'challenges', 3, 1000);