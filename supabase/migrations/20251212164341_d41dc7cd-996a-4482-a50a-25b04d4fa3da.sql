-- Create a security definer function to get achievement leaderboard data
-- This safely exposes aggregated stats without exposing individual user data

CREATE OR REPLACE FUNCTION public.get_achievement_leaderboard(
  time_period text DEFAULT 'all'
)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  avatar_url text,
  total_points bigint,
  achievement_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  start_date timestamptz;
BEGIN
  -- Calculate start date based on time period
  CASE time_period
    WHEN 'weekly' THEN start_date := now() - interval '7 days';
    WHEN 'monthly' THEN start_date := now() - interval '30 days';
    ELSE start_date := '1970-01-01'::timestamptz;
  END CASE;

  RETURN QUERY
  SELECT 
    p.id as user_id,
    COALESCE(p.full_name, 'Anonymous') as display_name,
    p.avatar_url,
    COALESCE(SUM(a.points), 0)::bigint as total_points,
    COUNT(ua.id)::bigint as achievement_count
  FROM public.profiles p
  LEFT JOIN public.user_achievements ua ON p.id = ua.user_id 
    AND ua.unlocked_at >= start_date
  LEFT JOIN public.achievements a ON ua.achievement_id = a.id
  GROUP BY p.id, p.full_name, p.avatar_url
  HAVING COUNT(ua.id) > 0
  ORDER BY total_points DESC, achievement_count DESC
  LIMIT 100;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_achievement_leaderboard(text) TO authenticated;