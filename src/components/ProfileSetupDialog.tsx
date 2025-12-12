import { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, Target, Calendar, Scale } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProfileSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onComplete: () => void;
}

export function ProfileSetupDialog({ 
  open, 
  onOpenChange, 
  userId,
  onComplete 
}: ProfileSetupDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [birthdate, setBirthdate] = useState('');
  const [currentWeight, setCurrentWeight] = useState('');
  const [goalWeight, setGoalWeight] = useState('');
  const [goalDate, setGoalDate] = useState('');
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg'>('lbs');

  const convertToKg = (weight: number, unit: 'lbs' | 'kg'): number => {
    return unit === 'lbs' ? weight * 0.453592 : weight;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!birthdate || !currentWeight || !goalWeight || !goalDate) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const currentWeightKg = convertToKg(parseFloat(currentWeight), weightUnit);
      const goalWeightKg = convertToKg(parseFloat(goalWeight), weightUnit);

      const { error } = await supabase
        .from('profiles')
        .update({
          birthdate,
          current_weight: currentWeightKg,
          goal_weight: goalWeightKg,
          goal_date: goalDate
        })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: "Profile updated!",
        description: "Your goals have been saved. Let's crush it!"
      });

      onComplete();
    } catch (error: any) {
      toast({
        title: "Error saving profile",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // Get today's date for min value on goal date
  const today = new Date().toISOString().split('T')[0];
  // Max birthdate is 13 years ago
  const maxBirthdate = new Date();
  maxBirthdate.setFullYear(maxBirthdate.getFullYear() - 13);
  const maxBirthdateStr = maxBirthdate.toISOString().split('T')[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Complete Your Profile
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <Label className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              Birth Date
            </Label>
            <Input
              type="date"
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
              max={maxBirthdateStr}
              className="bg-secondary/50"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-2"
          >
            <Label className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-muted-foreground" />
              Weight Unit
            </Label>
            <Select value={weightUnit} onValueChange={(v) => setWeightUnit(v as 'lbs' | 'kg')}>
              <SelectTrigger className="bg-secondary/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lbs">Pounds (lbs)</SelectItem>
                <SelectItem value="kg">Kilograms (kg)</SelectItem>
              </SelectContent>
            </Select>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-2 gap-4"
          >
            <div className="space-y-2">
              <Label>Current Weight ({weightUnit})</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={currentWeight}
                onChange={(e) => setCurrentWeight(e.target.value)}
                placeholder={weightUnit === 'lbs' ? '180' : '82'}
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-2">
              <Label>Goal Weight ({weightUnit})</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={goalWeight}
                onChange={(e) => setGoalWeight(e.target.value)}
                placeholder={weightUnit === 'lbs' ? '165' : '75'}
                className="bg-secondary/50"
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-2"
          >
            <Label className="flex items-center gap-2">
              <Target className="w-4 h-4 text-muted-foreground" />
              Goal Date
            </Label>
            <Input
              type="date"
              value={goalDate}
              onChange={(e) => setGoalDate(e.target.value)}
              min={today}
              className="bg-secondary/50"
            />
            <p className="text-xs text-muted-foreground">
              When do you want to reach your goal weight?
            </p>
          </motion.div>

          <Button
            type="submit"
            className="w-full"
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Save & Continue"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
