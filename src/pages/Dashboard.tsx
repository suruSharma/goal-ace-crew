import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { TaskCard } from '@/components/TaskCard';
import { DayCounter } from '@/components/DayCounter';
import { ProgressRing } from '@/components/ui/progress-ring';
import { StreakDisplay } from '@/components/StreakDisplay';
import { useStreak } from '@/hooks/useStreak';
import { useAchievements } from '@/hooks/useAchievements';
import { ChallengeSetupDialog } from '@/components/ChallengeSetupDialog';
import { ChallengeCompletion } from '@/components/ChallengeCompletion';
import { AchievementsDisplay } from '@/components/AchievementsDisplay';
import { TaskCardSkeletonGroup } from '@/components/TaskCardSkeleton';
import { PageLoadingSkeleton } from '@/components/PageLoadingSkeleton';
import { MotivationalQuote } from '@/components/MotivationalQuote';
import { useToast } from '@/hooks/use-toast';
import { 
  Flame, LogOut, Users, Trophy, 
  Calendar, TrendingUp, Loader2, Rocket,
  ChevronLeft, ChevronRight, RotateCcw, UserPlus, Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { differenceInDays, parseISO, startOfDay } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Task {
  id: string;
  templateId: string;
  name: string;
  description: string;
  weight: number;
  completed: boolean;
}

interface Challenge {
  id: string;
  currentDay: number;
  totalDays: number;
  startDate: string;
  isCompleted: boolean;
}

// Calculate which day of the challenge it is based on start date
const calculateCurrentDay = (startDate: string): number => {
  const start = startOfDay(parseISO(startDate));
  const today = startOfDay(new Date());
  return differenceInDays(today, start) + 1;
};

export default function Dashboard() {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [viewingDay, setViewingDay] = useState<number>(1);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [totalCompletedTasks, setTotalCompletedTasks] = useState(0);
  const [totalChallengePoints, setTotalChallengePoints] = useState(0);
  const [inviteCode, setInviteCode] = useState('');
  const [joiningGroup, setJoiningGroup] = useState(false);
  const [myGroups, setMyGroups] = useState<{ id: string; name: string; memberCount: number; userPoints: number }[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
      // Save user's timezone
      saveTimezone();
    }
  }, [user]);

  const saveTimezone = async () => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    await supabase
      .from('profiles')
      .update({ timezone })
      .eq('id', user!.id);
  };

  const fetchData = async () => {
    try {
      // Fetch profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user!.id)
        .maybeSingle();
      
      if (profile) {
        setProfileName(profile.full_name || 'Warrior');
        setAvatarUrl(profile.avatar_url);
      }

      // Check for existing active challenge
      const { data: existingChallenge } = await supabase
        .from('user_challenges')
        .select('*')
        .eq('user_id', user!.id)
        .eq('is_active', true)
        .maybeSingle();

      // Fetch user's groups
      await fetchUserGroups();

      if (!existingChallenge) {
        // No active challenge - user can start one manually if they want
        setLoading(false);
        return;
      }

      // Calculate current day based on start date (automatic day advancement)
      const calculatedDay = calculateCurrentDay(existingChallenge.start_date);
      const actualCurrentDay = Math.min(Math.max(1, calculatedDay), existingChallenge.total_days || 75);

      // Update current_day in DB if it changed
      if (existingChallenge.current_day !== actualCurrentDay) {
        await supabase
          .from('user_challenges')
          .update({ current_day: actualCurrentDay })
          .eq('id', existingChallenge.id);
      }

      const isCompleted = calculatedDay > (existingChallenge.total_days || 75);

      setChallenge({
        id: existingChallenge.id,
        currentDay: actualCurrentDay,
        totalDays: existingChallenge.total_days || 75,
        startDate: existingChallenge.start_date,
        isCompleted
      });

      // Calculate total stats for the challenge
      await fetchChallengeStats(existingChallenge.id);

      // Mark completion as shown (but don't show popup automatically - user can view via button)
      if (isCompleted && !existingChallenge.completion_shown) {
        await supabase
          .from('user_challenges')
          .update({ completion_shown: true })
          .eq('id', existingChallenge.id);
      }

      setViewingDay(actualCurrentDay);

      // Fetch tasks for current day
      await fetchOrCreateTasks(existingChallenge.id, actualCurrentDay);
    } catch (error: any) {
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUserGroups = async () => {
    try {
      const { data: memberships } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user!.id);

      if (memberships && memberships.length > 0) {
        const groupIds = memberships.map(m => m.group_id);
        
        const { data: groups } = await supabase
          .from('groups')
          .select('id, name')
          .in('id', groupIds)
          .eq('status', 'published');

        if (groups) {
          const groupsWithStats = await Promise.all(groups.map(async (g) => {
            const { count } = await supabase
              .from('group_members')
              .select('*', { count: 'exact', head: true })
              .eq('group_id', g.id);

            // Get user's points in this group
            const { data: userChallenge } = await supabase
              .from('user_challenges')
              .select('id')
              .eq('user_id', user!.id)
              .eq('is_active', true)
              .maybeSingle();

            let userPoints = 0;
            if (userChallenge) {
              const { data: tasks } = await supabase
                .from('daily_tasks')
                .select(`completed, challenges (weight)`)
                .eq('user_challenge_id', userChallenge.id)
                .eq('completed', true);

              if (tasks) {
                userPoints = tasks.reduce((sum: number, t: any) => sum + (t.challenges?.weight || 0), 0);
              }
            }

            return {
              id: g.id,
              name: g.name,
              memberCount: count || 0,
              userPoints
            };
          }));

          setMyGroups(groupsWithStats);
        }
      }
    } catch (error) {
      console.error('Error fetching user groups:', error);
    }
  };

  const handleQuickJoinGroup = async () => {
    if (!inviteCode.trim()) return;
    setJoiningGroup(true);

    try {
      // Check 3-group limit
      const { count } = await supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id);
      
      if (count && count >= 3) {
        toast({
          title: "Group limit reached",
          description: "You can only be a member of up to 3 groups",
          variant: "destructive"
        });
        return;
      }

      const { data: group, error: findError } = await supabase
        .from('groups')
        .select('id, name')
        .eq('invite_code', inviteCode.toLowerCase().trim())
        .maybeSingle();

      if (findError || !group) {
        throw new Error('Invalid invite code');
      }

      const { error: joinError } = await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          user_id: user!.id
        });

      if (joinError) {
        if (joinError.code === '23505') {
          throw new Error('You are already a member of this group');
        }
        throw joinError;
      }

      toast({
        title: "Joined group!",
        description: `Welcome to ${group.name}`
      });

      setInviteCode('');
      fetchUserGroups();
    } catch (error: any) {
      toast({
        title: "Error joining group",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setJoiningGroup(false);
    }
  };

  const fetchChallengeStats = async (challengeId: string) => {
    try {
      const { data: allTasks } = await supabase
        .from('daily_tasks')
        .select(`
          completed,
          challenges (weight)
        `)
        .eq('user_challenge_id', challengeId);

      if (allTasks) {
        const completedTasks = allTasks.filter((t: any) => t.completed);
        setTotalCompletedTasks(completedTasks.length);
        setTotalChallengePoints(
          completedTasks.reduce((sum: number, t: any) => sum + (t.challenges?.weight || 0), 0)
        );
      }
    } catch (error) {
      console.error('Error fetching challenge stats:', error);
    }
  };

  const fetchOrCreateTasks = useCallback(async (challengeId: string, dayNumber: number) => {
    setTasksLoading(true);
    try {
      // First try to fetch existing tasks
      let { data: dailyTasks } = await supabase
        .from('daily_tasks')
        .select(`
          id,
          completed,
          template_id,
          challenges (
            id,
            name,
            description,
            weight
          )
        `)
        .eq('user_challenge_id', challengeId)
        .eq('day_number', dayNumber);

      // If no tasks exist for this day, create them
      if (!dailyTasks || dailyTasks.length === 0) {
        // Get templates - first check for user's custom templates, then defaults
        const { data: challenge } = await supabase
          .from('user_challenges')
          .select('user_id')
          .eq('id', challengeId)
          .single();

        if (challenge) {
          // Try to get user's custom templates first
          let { data: templates } = await supabase
            .from('challenges')
            .select('*')
            .eq('created_by', challenge.user_id)
            .is('group_id', null);

          // Fall back to defaults if no custom templates
          if (!templates || templates.length === 0) {
            const { data: defaultTemplates } = await supabase
              .from('challenges')
              .select('*')
              .eq('is_default', true);
            templates = defaultTemplates;
          }

          if (templates && templates.length > 0) {
            const newTasks = templates.map(t => ({
              user_challenge_id: challengeId,
              template_id: t.id,
              day_number: dayNumber,
              completed: false
            }));

            await supabase.from('daily_tasks').insert(newTasks);

            // Fetch the newly created tasks
            const { data: createdTasks } = await supabase
              .from('daily_tasks')
              .select(`
                id,
                completed,
                template_id,
                challenges (
                  id,
                  name,
                  description,
                  weight
                )
              `)
              .eq('user_challenge_id', challengeId)
              .eq('day_number', dayNumber);

            dailyTasks = createdTasks;
          }
        }
      }

      if (dailyTasks) {
        const formattedTasks = dailyTasks.map((t: any) => ({
          id: t.id,
          templateId: t.template_id,
          name: t.challenges?.name || 'Unknown Task',
          description: t.challenges?.description || '',
          weight: t.challenges?.weight || 1,
          completed: t.completed
        }));
        setTasks(formattedTasks);
      } else {
        setTasks([]);
      }
    } finally {
      setTasksLoading(false);
    }
  }, []);

  const handleChallengeCreated = async (challengeId: string) => {
    setShowSetup(false);
    setTasksLoading(true);
    
    // Fetch the newly created challenge directly
    const { data: newChallenge } = await supabase
      .from('user_challenges')
      .select('*')
      .eq('id', challengeId)
      .single();
    
    if (newChallenge) {
      setChallenge({
        id: newChallenge.id,
        currentDay: 1,
        totalDays: newChallenge.total_days || 75,
        startDate: newChallenge.start_date,
        isCompleted: false
      });
      setViewingDay(1);
      setTotalCompletedTasks(0);
      setTotalChallengePoints(0);
      
      // Fetch tasks for day 1
      await fetchOrCreateTasks(newChallenge.id, 1);
    } else {
      setTasksLoading(false);
    }
  };

  const toggleTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newCompleted = !task.completed;
    
    // Optimistic update
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, completed: newCompleted } : t
    ));

    const { error } = await supabase
      .from('daily_tasks')
      .update({ 
        completed: newCompleted,
        completed_at: newCompleted ? new Date().toISOString() : null
      })
      .eq('id', taskId);

    if (error) {
      // Revert on error
      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, completed: !newCompleted } : t
      ));
      toast({
        title: "Error updating task",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const goToDay = async (day: number) => {
    if (!challenge || day < 1 || day > challenge.currentDay) return;
    setViewingDay(day);
    await fetchOrCreateTasks(challenge.id, day);
  };

  const restartChallenge = async () => {
    if (!user) return;
    
    try {
      // First, get ALL active challenges for this user (handles edge cases)
      const { data: allChallenges } = await supabase
        .from('user_challenges')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (allChallenges && allChallenges.length > 0) {
        const challengeIds = allChallenges.map(c => c.id);
        
        // Delete all daily tasks for these challenges
        await supabase
          .from('daily_tasks')
          .delete()
          .in('user_challenge_id', challengeIds);
        
        // Deactivate all challenges (safer than delete)
        await supabase
          .from('user_challenges')
          .update({ is_active: false })
          .in('id', challengeIds);
      }
      
      // Delete user's custom templates (not default ones)
      await supabase
        .from('challenges')
        .delete()
        .eq('created_by', user.id)
        .eq('is_default', false)
        .is('group_id', null);
      
      toast({
        title: "Challenge reset!",
        description: "You can now start a fresh challenge."
      });
      
      setChallenge(null);
      setTasks([]);
      setShowSetup(true);
    } catch (error: any) {
      toast({
        title: "Error restarting challenge",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const completedTasks = tasks.filter(t => t.completed).length;
  const totalPoints = tasks.filter(t => t.completed).reduce((sum, t) => sum + t.weight, 0);
  const progress = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0;
  const isViewingToday = challenge ? viewingDay === challenge.currentDay : true;
  const isChallengeComplete = challenge?.isCompleted || (challenge && challenge.currentDay >= challenge.totalDays && progress === 100);
  
  const { currentStreak, longestStreak, loading: streakLoading } = useStreak(challenge?.id);
  
  // Achievements
  const { 
    getProgress, 
    checkAndUnlockAchievements, 
    unlockedCount, 
    totalCount,
    loading: achievementsLoading 
  } = useAchievements(user?.id);

  // Calculate stats for achievements
  const userStats = {
    currentStreak,
    longestStreak,
    totalPoints: totalChallengePoints,
    totalTasks: totalCompletedTasks,
    completedChallenges: isChallengeComplete ? 1 : 0, // TODO: Track completed challenges count
  };

  const achievementsWithProgress = getProgress(userStats);

  // Check for new achievements when stats change
  useEffect(() => {
    if (user && !achievementsLoading && challenge) {
      checkAndUnlockAchievements(userStats);
    }
  }, [currentStreak, longestStreak, totalChallengePoints, totalCompletedTasks, isChallengeComplete]);

  // Check for challenge completion when all tasks are done on final day (mark as complete but don't show popup)
  useEffect(() => {
    const markChallengeComplete = async () => {
      if (challenge && !challenge.isCompleted && challenge.currentDay >= challenge.totalDays && progress === 100 && isViewingToday) {
        setChallenge(prev => prev ? { ...prev, isCompleted: true } : null);
        // Mark completion as shown in DB
        await supabase
          .from('user_challenges')
          .update({ completion_shown: true })
          .eq('id', challenge.id);
      }
    };
    markChallengeComplete();
  }, [challenge, progress, isViewingToday]);

  if (authLoading || loading) {
    return <PageLoadingSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Flame className="w-5 h-5 text-primary" />
            </div>
            <span className="font-display font-bold text-xl">75 Hard</span>
          </div>
          
          <nav className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/challenge-history">
                <Clock className="w-5 h-5" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" asChild>
              <Link to="/achievements">
                <Trophy className="w-5 h-5" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" asChild>
              <Link to="/groups">
                <Users className="w-5 h-5" />
              </Link>
            </Button>
            <Link to="/profile">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center text-primary-foreground font-semibold overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm">{profileName?.charAt(0)?.toUpperCase() || 'U'}</span>
                )}
              </div>
            </Link>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="w-5 h-5" />
            </Button>
          </nav>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto px-4 py-8">
        {/* Challenge Setup Dialog */}
        <ChallengeSetupDialog
          open={showSetup}
          onOpenChange={setShowSetup}
          userId={user!.id}
          onChallengeCreated={handleChallengeCreated}
        />

        {/* Challenge Completion Dialog */}
        <ChallengeCompletion
          open={showCompletion}
          onOpenChange={setShowCompletion}
          totalDays={challenge?.totalDays || 75}
          totalPoints={totalChallengePoints}
          longestStreak={longestStreak}
          completedTasksTotal={totalCompletedTasks}
          onStartNew={() => {
            setShowCompletion(false);
            restartChallenge();
          }}
        />

        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-2xl md:text-3xl font-display font-bold">
            Hello, {profileName}! 👋
          </h1>
          <div className="mt-3">
            <MotivationalQuote userId={user?.id} />
          </div>
        </motion.div>

        {/* Quick Actions - show when challenge exists */}
        {challenge && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mb-6 flex flex-wrap items-center gap-3"
          >
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  {isChallengeComplete ? 'Start New' : 'Restart'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{isChallengeComplete ? 'Start New Challenge?' : 'Restart Challenge?'}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {isChallengeComplete 
                      ? 'This will start a fresh challenge. Your previous stats will be reset but weight history will be preserved.'
                      : 'This will delete all your current progress and allow you to start a fresh challenge. Your weight history will be preserved.'
                    }
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={restartChallenge} 
                    className={isChallengeComplete ? '' : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'}
                  >
                    {isChallengeComplete ? 'Start New' : 'Restart'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </motion.div>
        )}

        {/* Stats Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Day Counter Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`bg-card rounded-2xl border border-border p-6 relative ${!challenge && myGroups.length === 0 ? 'md:col-span-3' : 'md:col-span-2'}`}
          >
            {challenge ? (
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <DayCounter currentDay={challenge.currentDay} totalDays={challenge.totalDays} />
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-center">
                    <div className="flex items-center gap-2 text-primary">
                      <Trophy className="w-5 h-5" />
                      <span className="text-3xl font-display font-bold">{totalPoints}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Points {isViewingToday ? 'Today' : `Day ${viewingDay}`}</p>
                  </div>
                  
                  <ProgressRing progress={progress} size={100}>
                    <div className="text-center">
                      <span className="text-xl font-display font-bold">{completedTasks}</span>
                      <span className="text-muted-foreground">/{tasks.length}</span>
                    </div>
                  </ProgressRing>
                </div>
              </div>
            ) : (
              <div className={`flex flex-col items-center justify-center text-center ${myGroups.length === 0 ? 'py-10' : 'py-6'}`}>
                <div className={`${myGroups.length === 0 ? 'w-16 h-16' : 'w-10 h-10'} bg-primary/10 rounded-full flex items-center justify-center mb-4`}>
                  <Rocket className={`${myGroups.length === 0 ? 'w-8 h-8' : 'w-5 h-5'} text-primary`} />
                </div>
                <h3 className={`font-display font-semibold mb-2 ${myGroups.length === 0 ? 'text-xl' : 'text-lg'}`}>No Active Challenge</h3>
                <p className={`text-muted-foreground mb-4 ${myGroups.length === 0 ? 'text-base max-w-sm' : 'text-sm'}`}>
                  {myGroups.length === 0 
                    ? 'Begin your transformation journey today. Start a personal challenge or join a group to stay accountable.'
                    : 'Start a personal challenge or join a group'
                  }
                </p>
                <div className={`flex flex-wrap gap-3 justify-center ${myGroups.length === 0 ? 'mb-6' : 'mb-4'}`}>
                  <Button onClick={() => setShowSetup(true)} className="gap-2" size={myGroups.length === 0 ? 'lg' : 'default'}>
                    <Flame className="w-4 h-4" />
                    Start Challenge
                  </Button>
                  <Button variant="outline" asChild className="gap-2" size={myGroups.length === 0 ? 'lg' : 'default'}>
                    <Link to="/groups">
                      <Users className="w-4 h-4" />
                      Browse Groups
                    </Link>
                  </Button>
                </div>
                
                {/* Quick Join with Invite Code */}
                <div className={`w-full pt-4 border-t border-border ${myGroups.length === 0 ? 'max-w-sm' : 'max-w-xs'}`}>
                  <p className="text-xs text-muted-foreground mb-2">Have an invite code?</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter code"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      className="text-sm"
                      onKeyDown={(e) => e.key === 'Enter' && handleQuickJoinGroup()}
                    />
                    <Button 
                      size="sm" 
                      onClick={handleQuickJoinGroup}
                      disabled={joiningGroup || !inviteCode.trim()}
                    >
                      {joiningGroup ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>

          {/* Quick Stats - only show when challenge exists */}
          {challenge && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-card rounded-2xl border border-border p-6"
            >
              <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Stats
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Current Day</span>
                  <span className="font-bold">{challenge.currentDay} / {challenge.totalDays}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{isViewingToday ? "Today's" : `Day ${viewingDay}`} Progress</span>
                  <span className="font-bold">{Math.round(progress)}%</span>
                </div>
              </div>
              
              {/* Streak Display */}
              <div className="mt-4 pt-4 border-t border-border">
                <StreakDisplay 
                  currentStreak={currentStreak} 
                  longestStreak={longestStreak} 
                  loading={streakLoading} 
                />
              </div>
            </motion.div>
          )}

          {/* Group Stats - show when no active challenge but user is in groups */}
          {!challenge && myGroups.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-card rounded-2xl border border-border p-6"
            >
              <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Group Stats
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Active Groups</span>
                  <span className="font-bold">{myGroups.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total Points</span>
                  <span className="font-bold text-primary">{myGroups.reduce((sum, g) => sum + g.userPoints, 0)}</span>
                </div>
                {myGroups.length > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Top Group</span>
                    <span className="font-bold truncate max-w-[150px]">
                      {myGroups.reduce((top, g) => g.userPoints > top.userPoints ? g : top, myGroups[0]).name}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}

        </div>

        {/* Group Challenges Section */}
        {myGroups.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-display font-semibold flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                My Groups
              </h2>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/groups">View All</Link>
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {myGroups.map((group) => (
                <Link 
                  key={group.id} 
                  to="/groups"
                  className="block"
                >
                  <div className="bg-card rounded-xl border border-border p-4 hover:border-primary/50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold truncate">{group.name}</h3>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {group.memberCount}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Your Points</span>
                      <span className="font-bold text-primary">{group.userPoints}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}

        {/* Day Tasks */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-display font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                {isViewingToday ? "Today's Tasks" : `Day ${viewingDay} Tasks`}
              </h2>
              
              {/* Day Navigation */}
              {challenge && challenge.currentDay > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={viewingDay <= 1 || tasksLoading}
                    onClick={() => goToDay(viewingDay - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground min-w-[60px] text-center">
                    Day {viewingDay}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={viewingDay >= challenge.currentDay || tasksLoading}
                    onClick={() => goToDay(viewingDay + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  {!isViewingToday && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-2"
                      onClick={() => goToDay(challenge.currentDay)}
                    >
                      Go to Today
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Past day indicator */}
          {!isViewingToday && (
            <div className="mb-4 p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-sm text-muted-foreground">
                You are viewing a past day. You can still mark tasks as complete if you missed them.
              </p>
            </div>
          )}
          
          {tasksLoading ? (
            <TaskCardSkeletonGroup count={5} />
          ) : (
            <div className="grid gap-3">
              {tasks.map((task, index) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + index * 0.05 }}
                >
                  <TaskCard
                    name={task.name}
                    description={task.description}
                    weight={task.weight}
                    completed={task.completed}
                    onToggle={() => toggleTask(task.id)}
                  />
                </motion.div>
              ))}
            </div>
          )}

          {progress === 100 && isViewingToday && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 p-6 rounded-2xl bg-primary/10 border border-primary/30 text-center"
            >
              <span className="text-4xl mb-2 block">🎉</span>
              <h3 className="font-display text-xl font-bold text-primary">Day Complete!</h3>
              <p className="text-muted-foreground mt-1">You crushed it today. See you tomorrow!</p>
            </motion.div>
          )}
        </motion.div>
      </main>

      {/* Start New Challenge Button - only show if no challenge */}
      {!challenge && !showSetup && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2">
          <Button size="lg" onClick={() => setShowSetup(true)}>
            <Rocket className="w-5 h-5 mr-2" />
            Start Your Challenge
          </Button>
        </div>
      )}
    </div>
  );
}
