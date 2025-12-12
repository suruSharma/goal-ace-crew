import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useAchievements } from '@/hooks/useAchievements';
import { useStreak } from '@/hooks/useStreak';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PageLoadingSkeleton } from '@/components/PageLoadingSkeleton';
import { AchievementIcon } from '@/components/AchievementIcon';
import { AppHeader } from '@/components/AppHeader';
import { 
  Flame, Trophy, Lock, Unlock, 
  Zap, Target, Star, Award, Users
} from 'lucide-react';
import { format } from 'date-fns';

const CATEGORIES = [
  { id: 'all', label: 'All', icon: Trophy },
  { id: 'streak', label: 'Streaks', icon: Flame },
  { id: 'points', label: 'Points', icon: Zap },
  { id: 'tasks', label: 'Tasks', icon: Target },
  { id: 'challenges', label: 'Challenges', icon: Award },
];

interface UnlockedAchievement {
  achievement_id: string;
  unlocked_at: string;
}

export default function Achievements() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [challengeId, setChallengeId] = useState<string | undefined>();
  const [unlockedDates, setUnlockedDates] = useState<Record<string, string>>({});
  const [userStats, setUserStats] = useState({
    currentStreak: 0,
    longestStreak: 0,
    totalPoints: 0,
    totalTasks: 0,
    completedChallenges: 0,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchChallengeAndStats();
      fetchUnlockedDates();
    }
  }, [user]);

  const fetchChallengeAndStats = async () => {
    if (!user) return;

    // Get active challenge
    const { data: challenge } = await supabase
      .from('user_challenges')
      .select('id, total_days, current_day')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (challenge) {
      setChallengeId(challenge.id);

      // Get completed tasks count and points
      const { data: tasks } = await supabase
        .from('daily_tasks')
        .select(`
          completed,
          challenges (weight)
        `)
        .eq('user_challenge_id', challenge.id);

      if (tasks) {
        const completedTasks = tasks.filter((t: any) => t.completed);
        const totalPoints = completedTasks.reduce((sum: number, t: any) => sum + (t.challenges?.weight || 0), 0);
        
        setUserStats(prev => ({
          ...prev,
          totalTasks: completedTasks.length,
          totalPoints,
          completedChallenges: challenge.current_day >= challenge.total_days ? 1 : 0,
        }));
      }
    }

    // Get all completed challenges count
    const { count } = await supabase
      .from('user_challenges')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_active', false);

    if (count) {
      setUserStats(prev => ({ ...prev, completedChallenges: count }));
    }
  };

  const fetchUnlockedDates = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('user_achievements')
      .select('achievement_id, unlocked_at')
      .eq('user_id', user.id);

    if (data) {
      const dates: Record<string, string> = {};
      data.forEach((ua: UnlockedAchievement) => {
        if (ua.unlocked_at) {
          dates[ua.achievement_id] = ua.unlocked_at;
        }
      });
      setUnlockedDates(dates);
    }
  };

  const { currentStreak, longestStreak } = useStreak(challengeId);

  useEffect(() => {
    setUserStats(prev => ({
      ...prev,
      currentStreak,
      longestStreak,
    }));
  }, [currentStreak, longestStreak]);

  const {
    achievements,
    unlockedIds,
    loading: achievementsLoading,
    getProgress,
  } = useAchievements(user?.id);

  const achievementsWithProgress = getProgress(userStats);

  const filteredAchievements = selectedCategory === 'all'
    ? achievementsWithProgress
    : achievementsWithProgress.filter(a => a.requirement_type === selectedCategory);

  const unlockedAchievements = filteredAchievements.filter(a => a.unlocked);
  const lockedAchievements = filteredAchievements.filter(a => !a.unlocked);

  if (authLoading || achievementsLoading) {
    return <PageLoadingSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader 
        title="Achievements" 
        icon={<Trophy className="w-6 h-6 text-primary" />}
      >
        <Button variant="outline" size="sm" asChild>
          <Link to="/achievements/leaderboard" className="gap-2">
            <Users className="w-4 h-4" />
            Leaderboard
          </Link>
        </Button>
        <Badge variant="secondary" className="text-sm">
          {unlockedIds.size} / {achievements.length}
        </Badge>
      </AppHeader>

      <main className="container max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Category Filters */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(category => {
            const Icon = category.icon;
            const isSelected = selectedCategory === category.id;
            return (
              <Button
                key={category.id}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category.id)}
                className="gap-2"
              >
                <Icon className="w-4 h-4" />
                {category.label}
              </Button>
            );
          })}
        </div>

        {/* Stats Overview */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-primary">{userStats.longestStreak}</p>
                <p className="text-sm text-muted-foreground">Longest Streak</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">{userStats.totalPoints}</p>
                <p className="text-sm text-muted-foreground">Total Points</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">{userStats.totalTasks}</p>
                <p className="text-sm text-muted-foreground">Tasks Completed</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">{userStats.completedChallenges}</p>
                <p className="text-sm text-muted-foreground">Challenges Done</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Unlocked Achievements */}
        {unlockedAchievements.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Unlock className="w-5 h-5 text-primary" />
              <h2 className="font-display font-semibold text-lg">Unlocked</h2>
              <Badge variant="secondary">{unlockedAchievements.length}</Badge>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2">
              <AnimatePresence>
                {unlockedAchievements.map((achievement, index) => (
                  <motion.div
                    key={achievement.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="border-primary/30 bg-primary/5">
                      <CardContent className="pt-6">
                        <div className="flex gap-4">
                          <div className="text-primary">
                            <AchievementIcon icon={achievement.icon} size="lg" />
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="font-semibold">{achievement.name}</h3>
                                <p className="text-sm text-muted-foreground">{achievement.description}</p>
                              </div>
                              <Badge variant="outline" className="text-primary border-primary">
                                +{achievement.points} pts
                              </Badge>
                            </div>
                            {unlockedDates[achievement.id] && (
                              <p className="text-xs text-muted-foreground">
                                Unlocked on {format(new Date(unlockedDates[achievement.id]), 'MMM d, yyyy')}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </section>
        )}

        {/* Locked Achievements */}
        {lockedAchievements.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-muted-foreground" />
              <h2 className="font-display font-semibold text-lg text-muted-foreground">Locked</h2>
              <Badge variant="outline">{lockedAchievements.length}</Badge>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2">
              <AnimatePresence>
                {lockedAchievements.map((achievement, index) => (
                  <motion.div
                    key={achievement.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="border-border/50 bg-muted/30">
                      <CardContent className="pt-6">
                        <div className="flex gap-4">
                          <div className="text-muted-foreground/50">
                            <AchievementIcon icon={achievement.icon} size="lg" />
                          </div>
                          <div className="flex-1 space-y-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="font-semibold text-muted-foreground">{achievement.name}</h3>
                                <p className="text-sm text-muted-foreground/70">{achievement.description}</p>
                              </div>
                              <Badge variant="outline" className="text-muted-foreground">
                                +{achievement.points} pts
                              </Badge>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Progress</span>
                                <span>{achievement.current} / {achievement.requirement_value}</span>
                              </div>
                              <Progress value={achievement.progress} className="h-2" />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </section>
        )}

        {/* Empty State */}
        {filteredAchievements.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Trophy className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-semibold text-lg">No achievements in this category</h3>
              <p className="text-muted-foreground">Try selecting a different category</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
