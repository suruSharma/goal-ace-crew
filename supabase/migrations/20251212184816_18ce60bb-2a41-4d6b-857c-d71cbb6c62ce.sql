-- Update function to handle complete profile deletion cascade
CREATE OR REPLACE FUNCTION public.handle_profile_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  group_record RECORD;
  top_member_id uuid;
  member_count int;
  user_challenge_ids uuid[];
BEGIN
  -- Get all user challenge IDs for this user
  SELECT ARRAY_AGG(id) INTO user_challenge_ids
  FROM public.user_challenges
  WHERE user_id = OLD.id;

  -- Delete daily_tasks for all user's challenges
  IF user_challenge_ids IS NOT NULL THEN
    DELETE FROM public.daily_tasks 
    WHERE user_challenge_id = ANY(user_challenge_ids);
  END IF;

  -- Delete user_challenges
  DELETE FROM public.user_challenges WHERE user_id = OLD.id;

  -- Delete user_achievements
  DELETE FROM public.user_achievements WHERE user_id = OLD.id;

  -- Delete user-created challenge templates (not group-specific ones which are handled below)
  DELETE FROM public.challenges 
  WHERE created_by = OLD.id AND group_id IS NULL;

  -- Delete favorite_quotes
  DELETE FROM public.favorite_quotes WHERE user_id = OLD.id;

  -- Delete weight_history
  DELETE FROM public.weight_history WHERE user_id = OLD.id;

  -- Delete cheers sent by or to this user
  DELETE FROM public.cheers WHERE from_user_id = OLD.id OR to_user_id = OLD.id;

  -- Delete group_comments by this user
  DELETE FROM public.group_comments WHERE user_id = OLD.id;

  -- Remove user from all groups they're a member of (but don't own)
  DELETE FROM public.group_members 
  WHERE user_id = OLD.id 
  AND group_id NOT IN (SELECT id FROM public.groups WHERE created_by = OLD.id);

  -- Handle groups owned by this user
  FOR group_record IN 
    SELECT id, status FROM public.groups WHERE created_by = OLD.id
  LOOP
    -- Get member count (excluding the user being deleted)
    SELECT COUNT(*) INTO member_count
    FROM public.group_members
    WHERE group_id = group_record.id AND user_id != OLD.id;

    IF group_record.status = 'draft' THEN
      -- Delete draft groups entirely
      DELETE FROM public.group_members WHERE group_id = group_record.id;
      DELETE FROM public.group_comments WHERE group_id = group_record.id;
      DELETE FROM public.cheers WHERE group_id = group_record.id;
      DELETE FROM public.challenges WHERE group_id = group_record.id;
      DELETE FROM public.groups WHERE id = group_record.id;
    ELSIF member_count = 0 THEN
      -- Delete published groups with no other members
      DELETE FROM public.group_members WHERE group_id = group_record.id;
      DELETE FROM public.group_comments WHERE group_id = group_record.id;
      DELETE FROM public.cheers WHERE group_id = group_record.id;
      DELETE FROM public.challenges WHERE group_id = group_record.id;
      DELETE FROM public.groups WHERE id = group_record.id;
    ELSE
      -- Transfer ownership to top leaderboard member
      SELECT gm.user_id INTO top_member_id
      FROM public.group_members gm
      LEFT JOIN public.user_challenges uc ON uc.user_id = gm.user_id AND uc.group_id = group_record.id AND uc.is_active = true
      LEFT JOIN public.daily_tasks dt ON dt.user_challenge_id = uc.id AND dt.completed = true
      LEFT JOIN public.challenges c ON c.id = dt.template_id
      WHERE gm.group_id = group_record.id AND gm.user_id != OLD.id
      GROUP BY gm.user_id
      ORDER BY COALESCE(SUM(c.weight), 0) DESC, gm.joined_at ASC
      LIMIT 1;

      -- Transfer ownership and remove deleted user from group
      UPDATE public.groups SET created_by = top_member_id WHERE id = group_record.id;
      DELETE FROM public.group_members WHERE group_id = group_record.id AND user_id = OLD.id;
    END IF;
  END LOOP;

  RETURN OLD;
END;
$$;