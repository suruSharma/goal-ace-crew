import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  requirement_type: string;
  requirement_value: number;
  points: number;
}

interface UserAchievement {
  achievement_id: string;
  unlocked_at: string;
}

interface UserStats {
  currentStreak: number;
  longestStreak: number;
  totalPoints: number;
  totalTasks: number;
  completedChallenges: number;
}

export function useAchievements(userId: string | undefined) {
  const { toast } = useToast();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [newlyUnlocked, setNewlyUnlocked] = useState<Achievement[]>([]);

  useEffect(() => {
    if (userId) {
      fetchAchievements();
      fetchUnlockedAchievements();
    }
  }, [userId]);

  const fetchAchievements = async () => {
    const { data, error } = await supabase
      .from('achievements')
      .select('*')
      .order('requirement_value', { ascending: true });

    if (!error && data) {
      setAchievements(data);
    }
    setLoading(false);
  };

  const fetchUnlockedAchievements = async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from('user_achievements')
      .select('achievement_id, unlocked_at')
      .eq('user_id', userId);

    if (!error && data) {
      setUnlockedIds(new Set(data.map(ua => ua.achievement_id)));
    }
  };

  const checkAndUnlockAchievements = useCallback(async (stats: UserStats) => {
    if (!userId || achievements.length === 0) return;

    const toUnlock: Achievement[] = [];

    for (const achievement of achievements) {
      if (unlockedIds.has(achievement.id)) continue;

      let qualifies = false;

      switch (achievement.requirement_type) {
        case 'streak':
          qualifies = stats.longestStreak >= achievement.requirement_value;
          break;
        case 'points':
          qualifies = stats.totalPoints >= achievement.requirement_value;
          break;
        case 'tasks':
          qualifies = stats.totalTasks >= achievement.requirement_value;
          break;
        case 'challenges':
          qualifies = stats.completedChallenges >= achievement.requirement_value;
          break;
      }

      if (qualifies) {
        toUnlock.push(achievement);
      }
    }

    if (toUnlock.length > 0) {
      // Insert all new achievements
      const inserts = toUnlock.map(a => ({
        user_id: userId,
        achievement_id: a.id
      }));

      const { error } = await supabase
        .from('user_achievements')
        .insert(inserts);

      if (!error) {
        setUnlockedIds(prev => {
          const newSet = new Set(prev);
          toUnlock.forEach(a => newSet.add(a.id));
          return newSet;
        });
        setNewlyUnlocked(toUnlock);

        // Show toast for each unlocked achievement
        toUnlock.forEach(a => {
          toast({
            title: "🏆 Achievement Unlocked!",
            description: `${a.name}: ${a.description}`,
          });
        });
      }
    }
  }, [userId, achievements, unlockedIds, toast]);

  const clearNewlyUnlocked = useCallback(() => {
    setNewlyUnlocked([]);
  }, []);

  const getUnlockedAchievements = useCallback(() => {
    return achievements.filter(a => unlockedIds.has(a.id));
  }, [achievements, unlockedIds]);

  const getLockedAchievements = useCallback(() => {
    return achievements.filter(a => !unlockedIds.has(a.id));
  }, [achievements, unlockedIds]);

  const getProgress = useCallback((stats: UserStats) => {
    return achievements.map(achievement => {
      let current = 0;
      switch (achievement.requirement_type) {
        case 'streak':
          current = stats.longestStreak;
          break;
        case 'points':
          current = stats.totalPoints;
          break;
        case 'tasks':
          current = stats.totalTasks;
          break;
        case 'challenges':
          current = stats.completedChallenges;
          break;
      }
      return {
        ...achievement,
        current,
        progress: Math.min(100, (current / achievement.requirement_value) * 100),
        unlocked: unlockedIds.has(achievement.id)
      };
    });
  }, [achievements, unlockedIds]);

  return {
    achievements,
    unlockedIds,
    loading,
    newlyUnlocked,
    checkAndUnlockAchievements,
    clearNewlyUnlocked,
    getUnlockedAchievements,
    getLockedAchievements,
    getProgress,
    unlockedCount: unlockedIds.size,
    totalCount: achievements.length
  };
}
