import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { TaskCard } from '@/components/TaskCard';
import { TaskCardSkeletonGroup } from '@/components/TaskCardSkeleton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Users, ChevronDown, ChevronUp, Loader2, Play, Trophy, Target } from 'lucide-react';
import { differenceInDays, parseISO, startOfDay } from 'date-fns';
import { Link } from 'react-router-dom';
import { ProgressRing } from '@/components/ui/progress-ring';

interface GroupTask {
  id: string;
  templateId: string;
  name: string;
  description: string;
  weight: number;
  completed: boolean;
}

interface GroupWithChallenge {
  id: string;
  name: string;
  totalDays: number;
  challengeId: string | null;
  startDate: string | null;
  currentDay: number;
  tasks: GroupTask[];
  loading: boolean;
  expanded: boolean;
  isCompleted: boolean;
  completionShown: boolean;
  totalPoints: number;
}

interface GroupTasksSectionProps {
  userId: string;
  onTaskToggle?: () => void;
}

interface GroupCompletionDialogProps {
  group: GroupWithChallenge;
  onClose: () => void;
}

function GroupCompletionDialog({ group, onClose }: GroupCompletionDialogProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        className="bg-card border border-accent/30 rounded-2xl p-8 max-w-md w-full text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-6xl mb-4 block">🏆</span>
        <h2 className="font-display text-2xl font-bold text-accent mb-2">
          Group Challenge Complete!
        </h2>
        <p className="text-muted-foreground mb-4">
          Congratulations! You've completed the <strong>{group.name}</strong> challenge!
        </p>
        <div className="flex justify-center gap-6 mb-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-accent">{group.totalDays}</div>
            <div className="text-sm text-muted-foreground">Days</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-accent">{group.totalPoints}</div>
            <div className="text-sm text-muted-foreground">Points</div>
          </div>
        </div>
        <Button onClick={onClose} className="w-full">
          Continue
        </Button>
      </motion.div>
    </motion.div>
  );
}

const calculateCurrentDay = (startDate: string, totalDays: number): number => {
  const start = startOfDay(parseISO(startDate));
  const today = startOfDay(new Date());
  const day = differenceInDays(today, start) + 1;
  return Math.min(Math.max(1, day), totalDays);
};

export function GroupTasksSection({ userId, onTaskToggle }: GroupTasksSectionProps) {
  const { toast } = useToast();
  const [groups, setGroups] = useState<GroupWithChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingChallenge, setStartingChallenge] = useState<string | null>(null);
  const [completedGroup, setCompletedGroup] = useState<GroupWithChallenge | null>(null);

  const fetchGroups = useCallback(async () => {
    try {
      // Get user's group memberships
      const { data: memberships } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', userId);

      if (!memberships || memberships.length === 0) {
        setLoading(false);
        return;
      }

      const groupIds = memberships.map(m => m.group_id);

      // Get group details
      const { data: groupsData } = await supabase
        .from('groups')
        .select('id, name, total_days')
        .in('id', groupIds)
        .eq('status', 'published');

      if (!groupsData || groupsData.length === 0) {
        setLoading(false);
        return;
      }

      // Get user's challenges for these groups
      const { data: challenges } = await supabase
        .from('user_challenges')
        .select('id, group_id, start_date, current_day, completion_shown')
        .eq('user_id', userId)
        .eq('is_active', true)
        .in('group_id', groupIds);

      const groupsWithChallenges: GroupWithChallenge[] = await Promise.all(groupsData.map(async g => {
        const challenge = challenges?.find(c => c.group_id === g.id);
        const currentDay = challenge?.start_date 
          ? calculateCurrentDay(challenge.start_date, g.total_days)
          : 1;
        const isCompleted = challenge?.start_date 
          ? calculateCurrentDay(challenge.start_date, g.total_days) > g.total_days
          : false;

        // Fetch total points for this group challenge
        let totalPoints = 0;
        if (challenge) {
          const { data: completedTasks } = await supabase
            .from('daily_tasks')
            .select('challenges (weight)')
            .eq('user_challenge_id', challenge.id)
            .eq('completed', true);
          
          if (completedTasks) {
            totalPoints = completedTasks.reduce((sum: number, t: any) => sum + (t.challenges?.weight || 0), 0);
          }
        }

        return {
          id: g.id,
          name: g.name,
          totalDays: g.total_days,
          challengeId: challenge?.id || null,
          startDate: challenge?.start_date || null,
          currentDay: Math.min(currentDay, g.total_days),
          tasks: [],
          loading: false,
          expanded: false,
          isCompleted,
          completionShown: challenge?.completion_shown || false,
          totalPoints
        };
      }));

      setGroups(groupsWithChallenges);
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const startGroupChallenge = async (groupId: string) => {
    setStartingChallenge(groupId);
    try {
      const group = groups.find(g => g.id === groupId);
      if (!group) return;

      // Create a user_challenge linked to this group
      const { data: newChallenge, error } = await supabase
        .from('user_challenges')
        .insert({
          user_id: userId,
          group_id: groupId,
          total_days: group.totalDays,
          is_active: true,
          current_day: 1,
          start_date: new Date().toISOString().split('T')[0]
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Challenge started!",
        description: `You've started the ${group.name} group challenge`
      });

      // Update local state
      setGroups(prev => prev.map(g => 
        g.id === groupId 
          ? { 
              ...g, 
              challengeId: newChallenge.id, 
              startDate: newChallenge.start_date,
              currentDay: 1,
              isCompleted: false,
              completionShown: false
            }
          : g
      ));

      // Auto-expand and fetch tasks
      await toggleGroupExpanded(groupId, newChallenge.id);
    } catch (error: any) {
      toast({
        title: "Error starting challenge",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setStartingChallenge(null);
    }
  };

  const fetchGroupTasks = async (groupId: string, challengeId: string, dayNumber: number) => {
    setGroups(prev => prev.map(g => 
      g.id === groupId ? { ...g, loading: true } : g
    ));

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

      // If no tasks exist, create them from group templates
      if (!dailyTasks || dailyTasks.length === 0) {
        // Get group's task templates
        let { data: templates } = await supabase
          .from('challenges')
          .select('*')
          .eq('group_id', groupId);

        // Fall back to defaults if no group templates
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

      const formattedTasks: GroupTask[] = dailyTasks?.map((t: any) => ({
        id: t.id,
        templateId: t.template_id,
        name: t.challenges?.name || 'Unknown Task',
        description: t.challenges?.description || '',
        weight: t.challenges?.weight || 1,
        completed: t.completed
      })) || [];

      setGroups(prev => prev.map(g => 
        g.id === groupId ? { ...g, tasks: formattedTasks, loading: false } : g
      ));
    } catch (error) {
      console.error('Error fetching group tasks:', error);
      setGroups(prev => prev.map(g => 
        g.id === groupId ? { ...g, loading: false } : g
      ));
    }
  };

  const toggleGroupExpanded = async (groupId: string, challengeId?: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    const newExpanded = !group.expanded;

    setGroups(prev => prev.map(g => 
      g.id === groupId ? { ...g, expanded: newExpanded } : g
    ));

    // Fetch tasks when expanding (if challenge exists and tasks not loaded)
    const cId = challengeId || group.challengeId;
    if (newExpanded && cId && group.tasks.length === 0) {
      await fetchGroupTasks(groupId, cId, group.currentDay);
    }
  };

  const checkGroupCompletion = async (group: GroupWithChallenge) => {
    // Check if all tasks are completed and it's the last day
    const allTasksCompleted = group.tasks.length > 0 && group.tasks.every(t => t.completed);
    const isFinalDay = group.currentDay >= group.totalDays;
    
    if (allTasksCompleted && isFinalDay && !group.completionShown && group.challengeId) {
      // Mark completion as shown in DB
      await supabase
        .from('user_challenges')
        .update({ completion_shown: true })
        .eq('id', group.challengeId);

      // Calculate total points
      const { data: completedTasks } = await supabase
        .from('daily_tasks')
        .select('challenges (weight)')
        .eq('user_challenge_id', group.challengeId)
        .eq('completed', true);
      
      const totalPoints = completedTasks?.reduce((sum: number, t: any) => sum + (t.challenges?.weight || 0), 0) || 0;

      // Show celebration
      setCompletedGroup({ ...group, totalPoints, completionShown: true });

      // Update local state
      setGroups(prev => prev.map(g => 
        g.id === group.id ? { ...g, completionShown: true, isCompleted: true, totalPoints } : g
      ));
    }
  };

  const toggleTask = async (groupId: string, taskId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    const task = group.tasks.find(t => t.id === taskId);
    if (!task) return;

    const newCompleted = !task.completed;

    // Optimistic update
    setGroups(prev => prev.map(g => 
      g.id === groupId 
        ? { ...g, tasks: g.tasks.map(t => t.id === taskId ? { ...t, completed: newCompleted } : t) }
        : g
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
      setGroups(prev => prev.map(g => 
        g.id === groupId 
          ? { ...g, tasks: g.tasks.map(t => t.id === taskId ? { ...t, completed: !newCompleted } : t) }
          : g
      ));
      toast({
        title: "Error updating task",
        description: error.message,
        variant: "destructive"
      });
    } else {
      onTaskToggle?.();
      
      // Check for group completion after task toggle
      const updatedGroup = {
        ...group,
        tasks: group.tasks.map(t => t.id === taskId ? { ...t, completed: newCompleted } : t)
      };
      await checkGroupCompletion(updatedGroup);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-6 bg-muted/50 rounded w-40 animate-pulse" />
        <div className="h-24 bg-muted/50 rounded animate-pulse" />
      </div>
    );
  }

  if (groups.length === 0) {
    return null;
  }

  // Calculate summary stats
  const activeGroupChallenges = groups.filter(g => g.challengeId);
  const totalGroupPoints = groups.reduce((sum, g) => sum + g.totalPoints, 0);
  const completedGroups = groups.filter(g => g.isCompleted).length;

  return (
    <>
      {/* Group Completion Dialog */}
      <AnimatePresence>
        {completedGroup && (
          <GroupCompletionDialog 
            group={completedGroup} 
            onClose={() => setCompletedGroup(null)} 
          />
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-display font-semibold flex items-center gap-2">
            <Users className="w-5 h-5 text-accent" />
            Group Challenges
          </h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/groups">View All Groups</Link>
          </Button>
        </div>

        {/* Summary Card when there are active group challenges */}
        {activeGroupChallenges.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-accent/5 border border-accent/20 rounded-xl p-4 mb-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-accent" />
                  <span className="text-sm text-muted-foreground">Active:</span>
                  <span className="font-semibold">{activeGroupChallenges.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-accent" />
                  <span className="text-sm text-muted-foreground">Total Points:</span>
                  <span className="font-semibold text-accent">{totalGroupPoints}</span>
                </div>
                {completedGroups > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Completed:</span>
                    <span className="font-semibold text-green-600">{completedGroups}</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        <div className="space-y-3">
          {groups.map((group) => {
            const completedTasks = group.tasks.filter(t => t.completed).length;
            const totalTasks = group.tasks.length;
            const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            return (
              <div 
                key={group.id}
                className="bg-card rounded-xl border-2 border-accent/20 overflow-hidden hover:border-accent/40 transition-colors"
              >
                {/* Group Header */}
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-accent/5 transition-colors"
                  onClick={() => group.challengeId && toggleGroupExpanded(group.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                      <Users className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{group.name}</h3>
                        {group.isCompleted && (
                          <span className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full">
                            Completed
                          </span>
                        )}
                      </div>
                      {group.challengeId ? (
                        <p className="text-sm text-muted-foreground">
                          Day {group.currentDay} of {group.totalDays}
                          {group.totalPoints > 0 && (
                            <span className="ml-2 text-accent">• {group.totalPoints} pts</span>
                          )}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {group.totalDays} day challenge • Not started
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {!group.challengeId ? (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="border-accent/30 hover:bg-accent/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          startGroupChallenge(group.id);
                        }}
                        disabled={startingChallenge === group.id}
                      >
                        {startingChallenge === group.id ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Play className="w-4 h-4 mr-2" />
                        )}
                        Start
                      </Button>
                    ) : (
                      <>
                        {group.expanded && totalTasks > 0 && (
                          <ProgressRing progress={progress} size={40}>
                            <span className="text-xs font-medium">{progress}%</span>
                          </ProgressRing>
                        )}
                        {group.expanded ? (
                          <ChevronUp className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Expandable Tasks */}
                <AnimatePresence>
                  {group.expanded && group.challengeId && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-accent/20"
                    >
                      <div className="p-4 space-y-2 bg-accent/5">
                        {group.loading ? (
                          <TaskCardSkeletonGroup count={3} />
                        ) : group.tasks.length > 0 ? (
                          <>
                            {group.tasks.map((task, index) => (
                              <motion.div
                                key={task.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                              >
                                <TaskCard
                                  name={task.name}
                                  description={task.description}
                                  weight={task.weight}
                                  completed={task.completed}
                                  onToggle={() => toggleTask(group.id, task.id)}
                                />
                              </motion.div>
                            ))}
                            
                            {/* Day Complete Message */}
                            {progress === 100 && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="mt-4 p-4 rounded-xl bg-accent/10 border border-accent/30 text-center"
                              >
                                <span className="text-2xl mb-1 block">🎉</span>
                                <h4 className="font-display font-bold text-accent">Day Complete!</h4>
                                <p className="text-sm text-muted-foreground">Great work on your group challenge!</p>
                              </motion.div>
                            )}
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No tasks configured for this group
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </motion.div>
    </>
  );
}
