
CREATE OR REPLACE FUNCTION public.get_friend_streaks(friend_ids uuid[])
RETURNS TABLE(
  user_id uuid,
  current_streak bigint,
  longest_streak bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  fid uuid;
  challenge_id uuid;
BEGIN
  FOREACH fid IN ARRAY friend_ids
  LOOP
    -- Verify friendship
    IF NOT are_friends(auth.uid(), fid) THEN
      CONTINUE;
    END IF;

    -- Find active personal challenge
    SELECT uc.id INTO challenge_id
    FROM public.user_challenges uc
    WHERE uc.user_id = fid
      AND uc.is_active = true
      AND uc.group_id IS NULL
    LIMIT 1;

    IF challenge_id IS NULL THEN
      -- Return zeros for friends without active challenges
      user_id := fid;
      current_streak := 0;
      longest_streak := 0;
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Calculate streaks from daily_tasks
    RETURN QUERY
    WITH day_completion AS (
      SELECT
        dt.day_number,
        CASE WHEN COUNT(*) = COUNT(*) FILTER (WHERE dt.completed = true) THEN true ELSE false END AS day_complete
      FROM public.daily_tasks dt
      WHERE dt.user_challenge_id = challenge_id
      GROUP BY dt.day_number
      ORDER BY dt.day_number
    ),
    streak_groups AS (
      SELECT
        day_number,
        day_complete,
        day_number - ROW_NUMBER() OVER (
          PARTITION BY day_complete
          ORDER BY day_number
        ) AS grp
      FROM day_completion
    ),
    streak_lengths AS (
      SELECT
        grp,
        COUNT(*) AS streak_len,
        MAX(day_number) AS max_day
      FROM streak_groups
      WHERE day_complete = true
      GROUP BY grp
    ),
    max_day_info AS (
      SELECT MAX(day_number) AS last_day FROM day_completion
    )
    SELECT
      fid AS user_id,
      COALESCE(
        (SELECT sl.streak_len FROM streak_lengths sl, max_day_info mdi
         WHERE sl.max_day = mdi.last_day LIMIT 1),
        0
      )::bigint AS current_streak,
      COALESCE((SELECT MAX(streak_len) FROM streak_lengths), 0)::bigint AS longest_streak;
  END LOOP;
END;
$function$;
