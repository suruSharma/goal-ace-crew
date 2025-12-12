import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { TaskCard } from '@/components/TaskCard';
import { DayCounter } from '@/components/DayCounter';
import { ProgressRing } from '@/components/ui/progress-ring';
import { useToast } from '@/hooks/use-toast';
import { 
  Flame, LogOut, Users, Plus, Settings, Trophy, 
  Calendar, TrendingUp, Loader2 
} from 'lucide-react';
import { Link } from 'react-router-dom';

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
  startDate: string;
}

export default function Dashboard() {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user!.id)
        .maybeSingle();
      
      if (profile) {
        setProfileName(profile.full_name || 'Warrior');
      }

      // Fetch or create challenge
      let { data: existingChallenge } = await supabase
        .from('user_challenges')
        .select('*')
        .eq('user_id', user!.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!existingChallenge) {
        // Create new challenge
        const { data: newChallenge, error: challengeError } = await supabase
          .from('user_challenges')
          .insert({ user_id: user!.id })
          .select()
          .single();

        if (challengeError) throw challengeError;
        existingChallenge = newChallenge;

        // Get default templates and create daily tasks
        const { data: templates } = await supabase
          .from('challenge_templates')
          .select('*')
          .eq('is_default', true);

        if (templates && templates.length > 0) {
          const dailyTasks = templates.map(t => ({
            user_challenge_id: newChallenge.id,
            template_id: t.id,
            day_number: 1,
            completed: false
          }));

          await supabase.from('daily_tasks').insert(dailyTasks);
        }
      }

      setChallenge({
        id: existingChallenge.id,
        currentDay: existingChallenge.current_day,
        startDate: existingChallenge.start_date
      });

      // Fetch today's tasks
      const { data: dailyTasks } = await supabase
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
        .eq('user_challenge_id', existingChallenge.id)
        .eq('day_number', existingChallenge.current_day);

      if (dailyTasks) {
        const formattedTasks = dailyTasks.map((t: any) => ({
          id: t.id,
          templateId: t.template_id,
          name: t.challenge_templates.name,
          description: t.challenge_templates.description,
          weight: t.challenge_templates.weight,
          completed: t.completed
        }));
        setTasks(formattedTasks);
      }
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

  const completedTasks = tasks.filter(t => t.completed).length;
  const totalPoints = tasks.filter(t => t.completed).reduce((sum, t) => sum + t.weight, 0);
  const progress = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0;

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
            <Button variant="ghost" size="icon" asChild>
              <Link to="/profile">
                <Settings className="w-5 h-5" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="w-5 h-5" />
            </Button>
          </nav>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto px-4 py-8">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl md:text-3xl font-display font-bold">
            Hello, {profileName}! 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            Stay consistent. Stay disciplined. Stay hard.
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Day Counter Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="md:col-span-2 bg-card rounded-2xl border border-border p-6"
          >
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <DayCounter currentDay={challenge?.currentDay || 1} />
              
              <div className="flex items-center gap-8">
                <div className="text-center">
                  <div className="flex items-center gap-2 text-primary">
                    <Trophy className="w-5 h-5" />
                    <span className="text-3xl font-display font-bold">{totalPoints}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Points Today</p>
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
                <span className="text-muted-foreground">Current Streak</span>
                <span className="font-bold">{challenge?.currentDay || 0} days</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Today's Progress</span>
                <span className="font-bold">{Math.round(progress)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Tasks Left</span>
                <span className="font-bold">{tasks.length - completedTasks}</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Today's Tasks */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-display font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Today's Tasks
            </h2>
          </div>
          
          <div className="grid gap-3">
            {tasks.map((task, index) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + index * 0.05 }}
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

          {progress === 100 && (
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
    </div>
  );
}
