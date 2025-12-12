import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { AppHeader } from '@/components/AppHeader';
import { PageLoadingSkeleton } from '@/components/PageLoadingSkeleton';
import { 
  Trophy, Calendar, CheckCircle2, Clock, 
  ArrowLeft, Flame, Target, TrendingUp
} from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';

interface ChallengeHistory {
  id: string;
  startDate: string;
  totalDays: number;
  currentDay: number;
  isCompleted: boolean;
  isActive: boolean;
  completedTasks: number;
  totalTasks: number;
  totalPoints: number;
}

export default function ChallengeHistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [challenges, setChallenges] = useState<ChallengeHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchChallengeHistory();
    }
  }, [user]);

  const fetchChallengeHistory = async () => {
    try {
      const { data: userChallenges, error } = await supabase
        .from('user_challenges')
        .select('id, start_date, total_days, current_day, is_active')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (userChallenges) {
        const challengesWithStats = await Promise.all(
          userChallenges.map(async (challenge) => {
            // Fetch tasks for this challenge
            const { data: tasks } = await supabase
              .from('daily_tasks')
              .select('completed, challenges(weight)')
              .eq('user_challenge_id', challenge.id);

            const completedTasks = tasks?.filter(t => t.completed).length || 0;
            const totalTasks = tasks?.length || 0;
            const totalPoints = tasks?.reduce((sum, t) => 
              t.completed ? sum + ((t.challenges as any)?.weight || 0) : sum, 0
            ) || 0;

            // A challenge is truly completed only if:
            // 1. All days have been reached (currentDay >= totalDays)
            // 2. AND 100% of tasks are completed
            const allDaysReached = challenge.current_day >= challenge.total_days;
            const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
            const isFullyCompleted = allDaysReached && completionRate === 100;

            return {
              id: challenge.id,
              startDate: challenge.start_date,
              totalDays: challenge.total_days,
              currentDay: Math.min(challenge.current_day, challenge.total_days),
              isCompleted: isFullyCompleted,
              isActive: challenge.is_active,
              completedTasks,
              totalTasks,
              totalPoints
            };
          })
        );

        setChallenges(challengesWithStats);
      }
    } catch (error) {
      console.error('Error fetching challenge history:', error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return <PageLoadingSkeleton />;
  }

  const completedChallenges = challenges.filter(c => c.isCompleted);
  const activeChallenges = challenges.filter(c => c.isActive && !c.isCompleted);
  const abandonedChallenges = challenges.filter(c => !c.isActive && !c.isCompleted);

  return (
    <>
      <main className="container mx-auto px-4 py-8 max-w-4xl">

        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-display font-bold flex items-center gap-3">
            <Clock className="w-8 h-8 text-primary" />
            Challenge History
          </h1>
          <p className="text-muted-foreground mt-2">
            View all your past and current challenges
          </p>
        </motion.div>

        {/* Stats Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          <div className="bg-card rounded-xl border border-border p-4 text-center">
            <div className="text-2xl font-bold text-primary">{challenges.length}</div>
            <div className="text-sm text-muted-foreground">Total Challenges</div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 text-center">
            <div className="text-2xl font-bold text-green-500">{completedChallenges.length}</div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 text-center">
            <div className="text-2xl font-bold text-orange-500">{activeChallenges.length}</div>
            <div className="text-sm text-muted-foreground">Active</div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 text-center">
            <div className="text-2xl font-bold">
              {challenges.reduce((sum, c) => sum + c.totalPoints, 0)}
            </div>
            <div className="text-sm text-muted-foreground">Total Points</div>
          </div>
        </motion.div>

        {/* Active Challenges */}
        {activeChallenges.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <h2 className="text-xl font-display font-semibold mb-4 flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              Active Challenge
            </h2>
            <div className="space-y-4">
              {activeChallenges.map((challenge) => (
                <ChallengeCard key={challenge.id} challenge={challenge} isActive />
              ))}
            </div>
          </motion.div>
        )}

        {/* Completed Challenges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-8"
        >
          <h2 className="text-xl font-display font-semibold mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            Completed Challenges
          </h2>
          
          {completedChallenges.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-8 text-center">
              <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">No Completed Challenges Yet</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Complete your first challenge to see it here!
              </p>
              <Button asChild>
                <Link to="/dashboard">
                  <Flame className="w-4 h-4 mr-2" />
                  Go to Dashboard
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {completedChallenges.map((challenge) => (
                <ChallengeCard key={challenge.id} challenge={challenge} />
              ))}
            </div>
          )}
        </motion.div>

        {/* Abandoned/Restarted Challenges */}
        {abandonedChallenges.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h2 className="text-xl font-display font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-muted-foreground" />
              Previous Attempts
            </h2>
            <div className="space-y-4">
              {abandonedChallenges.map((challenge) => (
                <ChallengeCard key={challenge.id} challenge={challenge} isAbandoned />
              ))}
            </div>
          </motion.div>
        )}
      </main>
    </>
  );
}

function ChallengeCard({ challenge, isActive = false, isAbandoned = false }: { challenge: ChallengeHistory; isActive?: boolean; isAbandoned?: boolean }) {
  const completionRate = challenge.totalTasks > 0 
    ? Math.round((challenge.completedTasks / challenge.totalTasks) * 100) 
    : 0;

  const getBorderClass = () => {
    if (isActive) return 'border-primary/50 bg-primary/5';
    if (isAbandoned) return 'border-muted-foreground/30 bg-muted/30';
    return 'border-border';
  };

  const getIconBgClass = () => {
    if (isActive) return 'bg-orange-500/20';
    if (isAbandoned) return 'bg-muted-foreground/20';
    return 'bg-primary/20';
  };

  const getProgressBarClass = () => {
    if (isActive) return 'bg-orange-500';
    if (isAbandoned) return 'bg-muted-foreground';
    return 'bg-primary';
  };

  return (
    <div className={`bg-card rounded-xl border p-5 ${getBorderClass()}`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getIconBgClass()}`}>
            {isActive ? (
              <Flame className="w-6 h-6 text-orange-500" />
            ) : isAbandoned ? (
              <Clock className="w-6 h-6 text-muted-foreground" />
            ) : (
              <CheckCircle2 className="w-6 h-6 text-primary" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-lg">
              {challenge.totalDays} Day Challenge
            </h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <Calendar className="w-4 h-4" />
              <span>Started {format(parseISO(challenge.startDate), 'MMM d, yyyy')}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 md:gap-6">
          <div className="text-center">
            <div className="text-lg font-bold">{challenge.currentDay}/{challenge.totalDays}</div>
            <div className="text-xs text-muted-foreground">Days</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-primary">{challenge.totalPoints}</div>
            <div className="text-xs text-muted-foreground">Points</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold flex items-center gap-1">
              <TrendingUp className="w-4 h-4 text-green-500" />
              {completionRate}%
            </div>
            <div className="text-xs text-muted-foreground">Completion</div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-4">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all ${getProgressBarClass()}`}
            style={{ width: `${(challenge.currentDay / challenge.totalDays) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
