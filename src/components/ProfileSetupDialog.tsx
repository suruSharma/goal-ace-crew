import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, Target, CalendarIcon, Scale, Ruler } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  const [birthdate, setBirthdate] = useState<Date | undefined>();
  const [goalDate, setGoalDate] = useState<Date | undefined>();
  const [currentWeight, setCurrentWeight] = useState('');
  const [goalWeight, setGoalWeight] = useState('');
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
    
    // No validation - allow empty fields
    setSaving(true);
    try {
      const heightValue = convertHeightToCm();
      const currentWeightKg = currentWeight ? convertWeightToKg(parseFloat(currentWeight), weightUnit) : null;
      const goalWeightKg = goalWeight ? convertWeightToKg(parseFloat(goalWeight), weightUnit) : null;
      const { error } = await supabase
        .from('profiles')
        .update({
          birthdate: birthdate ? format(birthdate, 'yyyy-MM-dd') : null,
          current_weight: currentWeightKg,
          goal_weight: goalWeightKg,
          goal_date: goalDate ? format(goalDate, 'yyyy-MM-dd') : null,
          height_cm: heightValue
        })
        .eq('id', userId);

      if (error) throw error;

      // Add initial weight to history if provided
      if (currentWeightKg) {
        await supabase
          .from('weight_history')
          .insert({
            user_id: userId,
            weight_kg: currentWeightKg
          });
      }

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

  const today = new Date();
  const maxBirthdate = new Date();
  maxBirthdate.setFullYear(maxBirthdate.getFullYear() - 13);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto animate-fade-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Complete Your Profile
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-muted-foreground" />
              Birth Date
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal bg-secondary/50",
                    !birthdate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {birthdate ? format(birthdate, "PPP") : "Pick your birth date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={birthdate}
                  onSelect={setBirthdate}
                  disabled={(date) => date > maxBirthdate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
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
          </div>

          <div className="space-y-2">
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
          </div>

          <div className="grid grid-cols-2 gap-4">
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
          </div>

          {calculatedBMI && (
            <div className="p-3 rounded-lg bg-secondary/50 border border-border">
              <Label className="text-xs text-muted-foreground">Current BMI (calculated)</Label>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-primary">{calculatedBMI}</span>
                <span className="text-sm text-muted-foreground">({getBMICategory(calculatedBMI)})</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Target className="w-4 h-4 text-muted-foreground" />
              Goal Date
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal bg-secondary/50",
                    !goalDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {goalDate ? format(goalDate, "PPP") : "Pick your goal date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={goalDate}
                  onSelect={setGoalDate}
                  disabled={(date) => date < today}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              When do you want to reach your goal weight?
            </p>
          </div>

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
