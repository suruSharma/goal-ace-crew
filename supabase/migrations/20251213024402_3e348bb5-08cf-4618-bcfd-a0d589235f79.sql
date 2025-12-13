-- Drop the existing check constraint
ALTER TABLE public.feed_posts DROP CONSTRAINT feed_posts_post_type_check;

-- Add updated check constraint with 'wall_message' type
ALTER TABLE public.feed_posts ADD CONSTRAINT feed_posts_post_type_check 
CHECK (post_type = ANY (ARRAY['task_completion', 'achievement', 'weight_log', 'challenge_started', 'challenge_completed', 'streak_milestone', 'wall_message']));

-- Update DELETE policy to allow:
-- 1. Users to delete their own posts (existing behavior)
-- 2. Wall owners to delete wall messages on their wall
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.feed_posts;

CREATE POLICY "Users can delete their own posts or wall messages on their wall" 
ON public.feed_posts 
FOR DELETE 
USING (
  auth.uid() = user_id 
  OR (post_type = 'wall_message' AND (content->>'to_user_id')::uuid = auth.uid())
);