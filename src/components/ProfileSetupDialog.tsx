import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, Target, Calendar, Scale, Ruler } from 'lucide-react';
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
  const [heightFeet, setHeightFeet] = useState('');
  const [heightInches, setHeightInches] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [heightUnit, setHeightUnit] = useState<'ft' | 'cm'>('ft');

  const convertWeightToKg = (weight: number, unit: 'lbs' | 'kg'): number => {
    return unit === 'lbs' ? weight * 0.453592 : weight;
  };

  const convertHeightToCm = (): number | null => {
    if (heightUnit === 'cm') {
      return heightCm ? parseFloat(heightCm) : null;
    }
    const feet = parseFloat(heightFeet) || 0;
    const inches = parseFloat(heightInches) || 0;
    if (feet === 0 && inches === 0) return null;
    return (feet * 12 + inches) * 2.54;
  };

  const calculatedBMI = useMemo(() => {
    const heightInCm = convertHeightToCm();
    const weightInKg = currentWeight ? convertWeightToKg(parseFloat(currentWeight), weightUnit) : null;
    
    if (!heightInCm || !weightInKg) return null;
    
    const bmi = weightInKg / Math.pow(heightInCm / 100, 2);
    return Math.round(bmi * 10) / 10;
  }, [currentWeight, weightUnit, heightFeet, heightInches, heightCm, heightUnit]);

  const getBMICategory = (bmi: number): string => {
    if (bmi < 18.5) return 'Underweight';
    if (bmi < 25) return 'Normal';
    if (bmi < 30) return 'Overweight';
    return 'Obese';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const heightValue = convertHeightToCm();
    
    if (!birthdate || !currentWeight || !goalWeight || !goalDate || !heightValue) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const currentWeightKg = convertWeightToKg(parseFloat(currentWeight), weightUnit);
      const goalWeightKg = convertWeightToKg(parseFloat(goalWeight), weightUnit);

      const { error } = await supabase
        .from('profiles')
        .update({
          birthdate,
          current_weight: currentWeightKg,
          goal_weight: goalWeightKg,
          goal_date: goalDate,
          height_cm: heightValue
        })
        .eq('id', userId);

      if (error) throw error;

      // Add initial weight to history
      await supabase
        .from('weight_history')
        .insert({
          user_id: userId,
          weight_kg: currentWeightKg
        });

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

  const today = new Date().toISOString().split('T')[0];
  const maxBirthdate = new Date();
  maxBirthdate.setFullYear(maxBirthdate.getFullYear() - 13);
  const maxBirthdateStr = maxBirthdate.toISOString().split('T')[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
              <Ruler className="w-4 h-4 text-muted-foreground" />
              Height
            </Label>
            <Select value={heightUnit} onValueChange={(v) => setHeightUnit(v as 'ft' | 'cm')}>
              <SelectTrigger className="bg-secondary/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ft">Feet & Inches</SelectItem>
                <SelectItem value="cm">Centimeters</SelectItem>
              </SelectContent>
            </Select>
            {heightUnit === 'ft' ? (
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  min="0"
                  max="8"
                  value={heightFeet}
                  onChange={(e) => setHeightFeet(e.target.value)}
                  placeholder="5 ft"
                  className="bg-secondary/50"
                />
                <Input
                  type="number"
                  min="0"
                  max="11"
                  value={heightInches}
                  onChange={(e) => setHeightInches(e.target.value)}
                  placeholder="10 in"
                  className="bg-secondary/50"
                />
              </div>
            ) : (
              <Input
                type="number"
                min="0"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                placeholder="178"
                className="bg-secondary/50"
              />
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
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

          {calculatedBMI && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-lg bg-secondary/50 border border-border"
            >
              <Label className="text-xs text-muted-foreground">Current BMI (calculated)</Label>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-primary">{calculatedBMI}</span>
                <span className="text-sm text-muted-foreground">({getBMICategory(calculatedBMI)})</span>
              </div>
            </motion.div>
          )}

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
