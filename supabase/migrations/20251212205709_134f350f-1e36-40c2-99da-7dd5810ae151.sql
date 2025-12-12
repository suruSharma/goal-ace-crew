-- Enable realtime for feed_posts table
ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_posts;

-- Enable realtime for friendships table (for friend request notifications)
ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;