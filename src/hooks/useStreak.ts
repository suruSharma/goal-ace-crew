import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  loading: boolean;
  recalculate: () => Promise<void>;
}

export function useStreak(challengeId: string | undefined): StreakData {
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  const calculateStreak = useCallback(async () => {
    if (!challengeId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      // Fetch all daily tasks for this challenge
      const { data: allTasks } = await supabase
        .from('daily_tasks')
        .select('day_number, completed')
        .eq('user_challenge_id', challengeId)
        .order('day_number', { ascending: false });

      if (!allTasks || allTasks.length === 0) {
        setCurrentStreak(0);
        setLongestStreak(0);
        setLoading(false);
        return;
      }

      // Group tasks by day
      const tasksByDay: Record<number, boolean[]> = {};
      allTasks.forEach(task => {
        if (!tasksByDay[task.day_number]) {
          tasksByDay[task.day_number] = [];
        }
        tasksByDay[task.day_number].push(task.completed || false);
      });

      // Check if a day is complete (all tasks completed)
      const isDayComplete = (dayNum: number): boolean => {
        const dayTasks = tasksByDay[dayNum];
        if (!dayTasks || dayTasks.length === 0) return false;
        return dayTasks.every(completed => completed);
      };

      // Get all days in descending order
      const days = Object.keys(tasksByDay).map(Number).sort((a, b) => b - a);
      
      // Calculate current streak (consecutive complete days from most recent)
      let current = 0;
      for (const day of days) {
        if (isDayComplete(day)) {
          current++;
        } else {
          break;
        }
      }

      // Calculate longest streak
      let longest = 0;
      let tempStreak = 0;
      const sortedDays = [...days].sort((a, b) => a - b);
      
      for (let i = 0; i < sortedDays.length; i++) {
        const day = sortedDays[i];
        if (isDayComplete(day)) {
          tempStreak++;
          longest = Math.max(longest, tempStreak);
        } else {
          tempStreak = 0;
        }
      }

      setCurrentStreak(current);
      setLongestStreak(longest);
    } catch (error) {
      console.error('Error calculating streak:', error);
    } finally {
      setLoading(false);
    }
  }, [challengeId]);

  useEffect(() => {
    if (!challengeId) {
      setLoading(false);
      return;
    }

    calculateStreak();
  }, [challengeId, calculateStreak]);

  return { currentStreak, longestStreak, loading, recalculate: calculateStreak };
}
