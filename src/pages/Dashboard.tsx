import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { TaskCard } from '@/components/TaskCard';
import { DayCounter } from '@/components/DayCounter';
import { ProgressRing } from '@/components/ui/progress-ring';
import { TaskConfigDialog } from '@/components/TaskConfigDialog';
import { ChallengeSetupDialog } from '@/components/ChallengeSetupDialog';
import { MotivationalQuote } from '@/components/MotivationalQuote';
import { useToast } from '@/hooks/use-toast';
import { 
  Flame, LogOut, Users, Trophy, 
  Calendar, TrendingUp, Loader2, Settings2, Rocket,
  ChevronLeft, ChevronRight, RotateCcw
} from 'lucide-react';
import { Link } from 'react-router-dom';
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
  const [viewingDay, setViewingDay] = useState<number>(1);
  const [tasksLoading, setTasksLoading] = useState(false);

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

      if (!existingChallenge) {
        // No active challenge - show setup dialog
        setShowSetup(true);
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

      setChallenge({
        id: existingChallenge.id,
        currentDay: actualCurrentDay,
        totalDays: existingChallenge.total_days || 75,
        startDate: existingChallenge.start_date
      });

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
          challenge_templates (
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
            .from('challenge_templates')
            .select('*')
            .eq('created_by', challenge.user_id)
            .is('group_id', null);

          // Fall back to defaults if no custom templates
          if (!templates || templates.length === 0) {
            const { data: defaultTemplates } = await supabase
              .from('challenge_templates')
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
                challenge_templates (
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
          name: t.challenge_templates?.name || 'Unknown Task',
          description: t.challenge_templates?.description || '',
          weight: t.challenge_templates?.weight || 1,
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
        startDate: newChallenge.start_date
      });
      setViewingDay(1);
      
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
    if (!challenge || !user) return;
    
    try {
      // Delete all daily tasks for this challenge
      await supabase
        .from('daily_tasks')
        .delete()
        .eq('user_challenge_id', challenge.id);
      
      // Delete the challenge itself
      await supabase
        .from('user_challenges')
        .delete()
        .eq('id', challenge.id);
      
      // Delete user's custom templates (not default ones)
      await supabase
        .from('challenge_templates')
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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
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
            <MotivationalQuote />
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Day Counter Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="md:col-span-2 bg-card rounded-2xl border border-border p-6 relative"
          >
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <DayCounter currentDay={challenge?.currentDay || 1} totalDays={challenge?.totalDays || 75} />
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
          </motion.div>

          {/* Quick Stats */}
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
                <span className="font-bold">{challenge?.currentDay || 0} / {challenge?.totalDays || 75}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{isViewingToday ? "Today's" : `Day ${viewingDay}`} Progress</span>
                <span className="font-bold">{Math.round(progress)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Tasks Left</span>
                <span className="font-bold">{tasks.length - completedTasks}</span>
              </div>
            </div>
            
            {challenge && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full mt-4 text-destructive hover:text-destructive">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Restart Challenge
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Restart Challenge?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will delete all your current progress and allow you to start a fresh challenge. Your weight history will be preserved.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={restartChallenge} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Restart
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </motion.div>
        </div>

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
            
            <TaskConfigDialog
              userId={user!.id}
              onSave={fetchData}
              trigger={
                <Button variant="ghost" size="sm">
                  <Settings2 className="w-4 h-4 mr-2" />
                  Configure
                </Button>
              }
            />
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
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground animate-pulse">Loading tasks...</p>
            </div>
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
