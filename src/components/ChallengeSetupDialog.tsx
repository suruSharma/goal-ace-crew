import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, Trash2, Loader2, Rocket, Zap, Clock, ListChecks
} from 'lucide-react';
import { TemplateListSkeleton } from '@/components/TaskCardSkeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Template {
  id: string;
  name: string;
  description: string;
  weight: number;
  isNew?: boolean;
}

interface ChallengeSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onChallengeCreated: (challengeId: string) => void;
}

const DURATION_PRESETS = [
  { days: 7, label: '7 Days', description: 'Quick sprint' },
  { days: 30, label: '30 Days', description: 'Monthly challenge' },
  { days: 75, label: '75 Days', description: 'Original 75 Hard' },
  { days: 0, label: 'Custom', description: 'Set your own' },
];

export function ChallengeSetupDialog({ 
  open, 
  onOpenChange, 
  userId,
  onChallengeCreated 
}: ChallengeSetupDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<'duration' | 'tasks'>('duration');
  const [totalDays, setTotalDays] = useState(75);
  const [customDays, setCustomDays] = useState('');
  const [useDefaultTasks, setUseDefaultTasks] = useState(true);
  const [defaultTemplates, setDefaultTemplates] = useState<Template[]>([]);
  const [customTemplates, setCustomTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      fetchDefaultTemplates();
      setStep('duration');
      setTotalDays(75);
      setCustomDays('');
      setUseDefaultTasks(true);
      setCustomTemplates([]);
    }
  }, [open]);

  const fetchDefaultTemplates = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('challenge_templates')
        .select('*')
        .eq('is_default', true);
      
      if (data) {
        setDefaultTemplates(data.map(t => ({
          id: t.id,
          name: t.name,
          description: t.description || '',
          weight: t.weight || 1
        })));
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const addCustomTask = () => {
    setCustomTemplates(prev => [...prev, {
      id: `new-${Date.now()}`,
      name: '',
      description: '',
      weight: 10,
      isNew: true
    }]);
  };

  const updateCustomTask = (id: string, field: keyof Template, value: string | number) => {
    setCustomTemplates(prev => prev.map(t => 
      t.id === id ? { ...t, [field]: value } : t
    ));
  };

  const removeCustomTask = (id: string) => {
    setCustomTemplates(prev => prev.filter(t => t.id !== id));
  };

  const handleDurationSelect = (days: number) => {
    if (days === 0) {
      setTotalDays(0);
    } else {
      setTotalDays(days);
      setStep('tasks');
    }
  };

  const handleCustomDaysConfirm = () => {
    const days = parseInt(customDays);
    if (days >= 1 && days <= 365) {
      setTotalDays(days);
      setStep('tasks');
    } else {
      toast({
        title: "Invalid duration",
        description: "Please enter a number between 1 and 365",
        variant: "destructive"
      });
    }
  };

  const createChallenge = async () => {
    const tasksToUse = useDefaultTasks ? defaultTemplates : customTemplates;
    
    if (tasksToUse.length === 0) {
      toast({
        title: "No tasks",
        description: "Please add at least one task",
        variant: "destructive"
      });
      return;
    }

    if (!useDefaultTasks) {
      const invalidTasks = customTemplates.filter(t => !t.name.trim());
      if (invalidTasks.length > 0) {
        toast({
          title: "Validation Error",
          description: "All tasks must have a name",
          variant: "destructive"
        });
        return;
      }
    }

    setCreating(true);
    try {
      // Create the challenge
      const { data: challenge, error: challengeError } = await supabase
        .from('user_challenges')
        .insert({
          user_id: userId,
          total_days: totalDays,
          current_day: 1,
          is_active: true
        })
        .select()
        .single();

      if (challengeError) throw challengeError;

      let templateIds: string[] = [];

      if (useDefaultTasks) {
        templateIds = defaultTemplates.map(t => t.id);
      } else {
        // Create custom templates
        const templatesData = customTemplates.map(t => ({
          name: t.name,
          description: t.description || null,
          weight: t.weight || 10,
          created_by: userId,
          is_default: false
        }));

        const { data: newTemplates, error: templatesError } = await supabase
          .from('challenge_templates')
          .insert(templatesData)
          .select();

        if (templatesError) throw templatesError;
        templateIds = newTemplates?.map(t => t.id) || [];
      }

      // Create day 1 tasks
      const dailyTasks = templateIds.map(templateId => ({
        user_challenge_id: challenge.id,
        template_id: templateId,
        day_number: 1,
        completed: false
      }));

      await supabase.from('daily_tasks').insert(dailyTasks);

      toast({
        title: "Challenge started! 🔥",
        description: `Your ${totalDays}-day challenge begins now!`
      });

      onOpenChange(false);
      onChallengeCreated(challenge.id);
    } catch (error: any) {
      toast({
        title: "Error creating challenge",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-primary" />
            {step === 'duration' ? 'Choose Your Challenge Duration' : 'Configure Your Tasks'}
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === 'duration' && (
            <motion.div
              key="duration"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                {DURATION_PRESETS.map((preset) => (
                  <button
                    key={preset.days}
                    onClick={() => handleDurationSelect(preset.days)}
                    className={`p-4 rounded-xl border text-left transition-all hover:border-primary/50 ${
                      totalDays === preset.days && preset.days !== 0
                        ? 'bg-primary/10 border-primary/30'
                        : 'bg-card border-border'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4 text-primary" />
                      <span className="font-semibold">{preset.label}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{preset.description}</p>
                  </button>
                ))}
              </div>

              {totalDays === 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-3"
                >
                  <Label>Number of Days</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={customDays}
                      onChange={(e) => setCustomDays(e.target.value)}
                      placeholder="Enter number of days"
                      className="bg-secondary/50"
                    />
                    <Button onClick={handleCustomDaysConfirm}>
                      Continue
                    </Button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {step === 'tasks' && (
            <motion.div
              key="tasks"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-3">
                  Starting a <span className="font-semibold text-primary">{totalDays}-day</span> challenge
                </p>
                
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setUseDefaultTasks(true)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      useDefaultTasks
                        ? 'bg-primary/10 border-primary/30'
                        : 'bg-card border-border hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="w-4 h-4 text-primary" />
                      <span className="font-semibold">Default 75 Hard</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Use the original challenge tasks</p>
                  </button>
                  
                  <button
                    onClick={() => {
                      setUseDefaultTasks(false);
                      if (customTemplates.length === 0) {
                        addCustomTask();
                      }
                    }}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      !useDefaultTasks
                        ? 'bg-primary/10 border-primary/30'
                        : 'bg-card border-border hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <ListChecks className="w-4 h-4 text-primary" />
                      <span className="font-semibold">Custom Tasks</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Create your own challenge tasks</p>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                {useDefaultTasks ? (
                  loading ? (
                    <TemplateListSkeleton count={5} />
                  ) : (
                    defaultTemplates.map((task) => (
                      <div
                        key={task.id}
                        className="p-3 rounded-xl bg-secondary/30 border border-border"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{task.name}</h4>
                            {task.description && (
                              <p className="text-sm text-muted-foreground">{task.description}</p>
                            )}
                          </div>
                          <span className="text-sm font-medium text-primary">{task.weight} pts</span>
                        </div>
                      </div>
                    ))
                  )
                ) : (
                  <>
                    <AnimatePresence mode="popLayout">
                      {customTemplates.map((task) => (
                        <motion.div
                          key={task.id}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="p-4 rounded-xl bg-secondary/30 border border-border"
                        >
                          <div className="space-y-3">
                            <div className="grid grid-cols-4 gap-3">
                              <div className="col-span-2 space-y-1">
                                <Label className="text-xs text-muted-foreground">Task Name</Label>
                                <Input
                                  value={task.name}
                                  onChange={(e) => updateCustomTask(task.id, 'name', e.target.value)}
                                  placeholder="e.g., Morning Run"
                                  className="bg-background"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Points</Label>
                                <Input
                                  type="number"
                                  min={1}
                                  max={100}
                                  value={task.weight}
                                  onChange={(e) => updateCustomTask(task.id, 'weight', parseInt(e.target.value) || 1)}
                                  className="bg-background"
                                />
                              </div>
                              <div className="flex items-end">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => removeCustomTask(task.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Description (optional)</Label>
                              <Input
                                value={task.description}
                                onChange={(e) => updateCustomTask(task.id, 'description', e.target.value)}
                                placeholder="e.g., At least 30 minutes"
                                className="bg-background"
                              />
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={addCustomTask}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Task
                    </Button>
                  </>
                )}
              </div>

              <div className="pt-4 border-t border-border mt-4 flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep('duration')}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={createChallenge}
                  disabled={creating}
                  className="flex-1"
                >
                  {creating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Rocket className="w-4 h-4 mr-2" />
                      Start Challenge
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
