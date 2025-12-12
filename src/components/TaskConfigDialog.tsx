import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, Trash2, GripVertical, Loader2, Settings2, Save
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Template {
  id: string;
  name: string;
  description: string;
  weight: number;
  isNew?: boolean;
}

interface TaskConfigDialogProps {
  groupId?: string | null;
  userId: string;
  isGroupCreator?: boolean;
  onSave?: () => void;
  trigger?: React.ReactNode;
  defaultOpen?: boolean;
}

export function TaskConfigDialog({ 
  groupId, 
  userId, 
  isGroupCreator = false,
  onSave,
  trigger,
  defaultOpen = false
}: TaskConfigDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(defaultOpen);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    if (defaultOpen) {
      setOpen(true);
    }
  }, [defaultOpen]);

  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [open, groupId]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('challenge_templates')
        .select('*');

      if (groupId) {
        // For groups, get group-specific templates or defaults
        query = query.or(`group_id.eq.${groupId},and(is_default.eq.true,group_id.is.null)`);
      } else {
        // For individual, get user's custom templates or defaults
        query = query.or(`created_by.eq.${userId},and(is_default.eq.true,created_by.is.null)`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Prioritize custom templates over defaults
      const customTemplates = data?.filter(t => 
        groupId ? t.group_id === groupId : t.created_by === userId
      ) || [];
      
      const defaultTemplates = data?.filter(t => t.is_default) || [];
      
      const templatesToUse = customTemplates.length > 0 ? customTemplates : defaultTemplates;
      
      setTemplates(templatesToUse.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description || '',
        weight: t.weight || 1
      })));
    } catch (error: any) {
      toast({
        title: "Error loading templates",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addTemplate = () => {
    setTemplates(prev => [...prev, {
      id: `new-${Date.now()}`,
      name: '',
      description: '',
      weight: 1,
      isNew: true
    }]);
  };

  const updateTemplate = (id: string, field: keyof Template, value: string | number) => {
    setTemplates(prev => prev.map(t => 
      t.id === id ? { ...t, [field]: value } : t
    ));
  };

  const removeTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  const saveTemplates = async () => {
    // Validate
    const invalidTemplates = templates.filter(t => !t.name.trim());
    if (invalidTemplates.length > 0) {
      toast({
        title: "Validation Error",
        description: "All tasks must have a name",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      // Delete existing custom templates
      if (groupId) {
        await supabase
          .from('challenge_templates')
          .delete()
          .eq('group_id', groupId);
      } else {
        await supabase
          .from('challenge_templates')
          .delete()
          .eq('created_by', userId)
          .is('group_id', null);
      }

      // Insert new templates
      const templatesData = templates.map(t => ({
        name: t.name,
        description: t.description || null,
        weight: t.weight || 1,
        group_id: groupId || null,
        created_by: userId,
        is_default: false
      }));

      const { error } = await supabase
        .from('challenge_templates')
        .insert(templatesData);

      if (error) throw error;

      toast({
        title: "Tasks saved!",
        description: "Your challenge tasks have been updated"
      });

      setOpen(false);
      onSave?.();
    } catch (error: any) {
      toast({
        title: "Error saving tasks",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const canEdit = !groupId || isGroupCreator;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Settings2 className="w-4 h-4 mr-2" />
            Configure Tasks
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" />
            {groupId ? 'Group Challenge Tasks' : 'My Challenge Tasks'}
          </DialogTitle>
        </DialogHeader>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
              <AnimatePresence mode="popLayout">
                {templates.map((template, index) => (
                  <motion.div
                    key={template.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-4 rounded-xl bg-secondary/30 border border-border"
                  >
                    <div className="flex items-start gap-3">
                      <div className="pt-2 text-muted-foreground">
                        <GripVertical className="w-4 h-4" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs text-muted-foreground">Task Name</Label>
                            <Input
                              value={template.name}
                              onChange={(e) => updateTemplate(template.id, 'name', e.target.value)}
                              placeholder="e.g., Workout 1"
                              className="bg-background"
                              disabled={!canEdit}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Weight</Label>
                            <Input
                              type="number"
                              min={1}
                              max={100}
                              value={template.weight}
                              onChange={(e) => updateTemplate(template.id, 'weight', parseInt(e.target.value) || 1)}
                              className="bg-background"
                              disabled={!canEdit}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Description (optional)</Label>
                          <Input
                            value={template.description}
                            onChange={(e) => updateTemplate(template.id, 'description', e.target.value)}
                            placeholder="e.g., 45 min minimum, outdoor"
                            className="bg-background"
                            disabled={!canEdit}
                          />
                        </div>
                      </div>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => removeTemplate(template.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {canEdit && (
              <div className="pt-4 border-t border-border mt-4 space-y-3">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={addTemplate}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Task
                </Button>
                
                <Button
                  className="w-full"
                  onClick={saveTemplates}
                  disabled={saving || templates.length === 0}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Tasks
                    </>
                  )}
                </Button>
              </div>
            )}

            {!canEdit && (
              <p className="text-sm text-muted-foreground text-center pt-4 border-t border-border mt-4">
                Only the group creator can edit these tasks.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
