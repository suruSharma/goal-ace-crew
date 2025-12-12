import { supabase } from '@/integrations/supabase/client';

type PostType = 'task_completion' | 'achievement' | 'weight_log' | 'challenge_started' | 'challenge_completed' | 'streak_milestone';

interface PostContent {
  taskCount?: number;
  taskName?: string;
  points?: number;
  name?: string;
  description?: string;
  weight?: number;
  days?: number;
}

export async function createFeedPost(
  userId: string,
  postType: PostType,
  content: PostContent,
  message?: string
) {
  try {
    // Use type assertion since the types file may not be updated yet
    const { error } = await (supabase
      .from('feed_posts' as any)
      .insert({
        user_id: userId,
        post_type: postType,
        content,
        message
      }) as any);

    if (error) {
      console.error('Error creating feed post:', error);
    }
  } catch (error) {
    console.error('Error creating feed post:', error);
  }
}

// Helper functions for specific post types
export async function postTaskCompletion(userId: string, taskCount: number, points: number) {
  await createFeedPost(userId, 'task_completion', { taskCount, points });
}

export async function postAchievementUnlocked(userId: string, name: string, description: string, points: number) {
  await createFeedPost(userId, 'achievement', { name, description, points });
}

export async function postWeightLog(userId: string, weight: number) {
  await createFeedPost(userId, 'weight_log', { weight });
}

export async function postChallengeStarted(userId: string, days: number) {
  await createFeedPost(userId, 'challenge_started', { days });
}

export async function postChallengeCompleted(userId: string, days: number, points: number) {
  await createFeedPost(userId, 'challenge_completed', { days, points });
}

export async function postStreakMilestone(userId: string, days: number) {
  await createFeedPost(userId, 'streak_milestone', { days });
}
