-- Function to handle group cleanup when a profile is deleted
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
BEGIN
  -- Loop through all groups created by this user
  FOR group_record IN 
    SELECT id, status FROM public.groups WHERE created_by = OLD.id
  LOOP
    -- Get member count (excluding the user being deleted)
    SELECT COUNT(*) INTO member_count
    FROM public.group_members
    WHERE group_id = group_record.id AND user_id != OLD.id;

    IF group_record.status = 'draft' THEN
      -- Delete draft groups
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
      -- Get member with highest points (excluding user being deleted)
      SELECT gm.user_id INTO top_member_id
      FROM public.group_members gm
      LEFT JOIN public.user_challenges uc ON uc.user_id = gm.user_id AND uc.group_id = group_record.id AND uc.is_active = true
      LEFT JOIN public.daily_tasks dt ON dt.user_challenge_id = uc.id AND dt.completed = true
      LEFT JOIN public.challenges c ON c.id = dt.template_id
      WHERE gm.group_id = group_record.id AND gm.user_id != OLD.id
      GROUP BY gm.user_id
      ORDER BY COALESCE(SUM(c.weight), 0) DESC, gm.joined_at ASC
      LIMIT 1;

      -- Transfer ownership
      UPDATE public.groups 
      SET created_by = top_member_id 
      WHERE id = group_record.id;
    END IF;
  END LOOP;

  RETURN OLD;
END;
$$;

-- Create trigger to run before profile deletion
DROP TRIGGER IF EXISTS on_profile_delete ON public.profiles;
CREATE TRIGGER on_profile_delete
  BEFORE DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_deletion();