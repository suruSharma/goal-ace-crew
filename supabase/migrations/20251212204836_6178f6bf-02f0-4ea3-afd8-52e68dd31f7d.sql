-- Create friendships table
CREATE TABLE public.friendships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(requester_id, addressee_id)
);

-- Create feed_posts table
CREATE TABLE public.feed_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_type TEXT NOT NULL CHECK (post_type IN ('task_completion', 'achievement', 'weight_log', 'challenge_started', 'challenge_completed', 'streak_milestone')),
  content JSONB NOT NULL DEFAULT '{}',
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create feed_reactions table
CREATE TABLE public.feed_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL DEFAULT '❤️',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id, emoji)
);

-- Create feed_comments table
CREATE TABLE public.feed_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_comments ENABLE ROW LEVEL SECURITY;

-- Create helper function for checking friendship
CREATE OR REPLACE FUNCTION public.are_friends(_user_id uuid, _friend_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.friendships
    WHERE status = 'accepted'
      AND ((requester_id = _user_id AND addressee_id = _friend_id)
           OR (requester_id = _friend_id AND addressee_id = _user_id))
  )
$$;

-- Friendships policies
CREATE POLICY "Users can view their own friendships"
ON public.friendships FOR SELECT
USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Users can send friend requests"
ON public.friendships FOR INSERT
WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can update friendships they're part of"
ON public.friendships FOR UPDATE
USING (auth.uid() = addressee_id OR auth.uid() = requester_id);

CREATE POLICY "Users can delete their own friendships"
ON public.friendships FOR DELETE
USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Feed posts policies
CREATE POLICY "Users can view their own posts"
ON public.feed_posts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can view friends' posts"
ON public.feed_posts FOR SELECT
USING (public.are_friends(auth.uid(), user_id));

CREATE POLICY "Users can create their own posts"
ON public.feed_posts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts"
ON public.feed_posts FOR DELETE
USING (auth.uid() = user_id);

-- Feed reactions policies
CREATE POLICY "Users can view reactions on visible posts"
ON public.feed_reactions FOR SELECT
USING (
  post_id IN (
    SELECT id FROM public.feed_posts
    WHERE user_id = auth.uid() OR public.are_friends(auth.uid(), user_id)
  )
);

CREATE POLICY "Users can add reactions to friends' posts"
ON public.feed_reactions FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  post_id IN (
    SELECT id FROM public.feed_posts
    WHERE user_id = auth.uid() OR public.are_friends(auth.uid(), feed_posts.user_id)
  )
);

CREATE POLICY "Users can remove their own reactions"
ON public.feed_reactions FOR DELETE
USING (auth.uid() = user_id);

-- Feed comments policies
CREATE POLICY "Users can view comments on visible posts"
ON public.feed_comments FOR SELECT
USING (
  post_id IN (
    SELECT id FROM public.feed_posts
    WHERE user_id = auth.uid() OR public.are_friends(auth.uid(), user_id)
  )
);

CREATE POLICY "Users can add comments to friends' posts"
ON public.feed_comments FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  post_id IN (
    SELECT id FROM public.feed_posts
    WHERE user_id = auth.uid() OR public.are_friends(auth.uid(), feed_posts.user_id)
  )
);

CREATE POLICY "Users can delete their own comments"
ON public.feed_comments FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updating friendships updated_at
CREATE TRIGGER update_friendships_updated_at
BEFORE UPDATE ON public.friendships
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster friend lookups
CREATE INDEX idx_friendships_users ON public.friendships (requester_id, addressee_id, status);
CREATE INDEX idx_feed_posts_user_created ON public.feed_posts (user_id, created_at DESC);
CREATE INDEX idx_feed_reactions_post ON public.feed_reactions (post_id);
CREATE INDEX idx_feed_comments_post ON public.feed_comments (post_id);