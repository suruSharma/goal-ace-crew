import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FriendStreak {
  user_id: string;
  current_streak: number;
  longest_streak: number;
}

export function useFriendStreaks(friendIds: string[]) {
  const [streaks, setStreaks] = useState<FriendStreak[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (friendIds.length === 0) {
      setStreaks([]);
      return;
    }

    const fetchStreaks = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc('get_friend_streaks', {
          friend_ids: friendIds,
        } as any);

        if (error) throw error;
        setStreaks(
          (data || []).map((d: any) => ({
            user_id: d.user_id,
            current_streak: Number(d.current_streak),
            longest_streak: Number(d.longest_streak),
          }))
        );
      } catch (err) {
        console.error('Error fetching friend streaks:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStreaks();
  }, [friendIds.join(',')]);

  return { streaks, loading };
}
