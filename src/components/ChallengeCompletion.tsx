import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Trophy, Flame, Calendar, Target, Zap, RotateCcw, PartyPopper } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ChallengeCompletionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalDays: number;
  totalPoints: number;
  longestStreak: number;
  completedTasksTotal: number;
  onStartNew: () => void;
}

const confettiColors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#9B59B6', '#3498DB', '#E74C3C'];

function Confetti() {
  const [particles, setParticles] = useState<{ id: number; x: number; color: string; delay: number; duration: number }[]>([]);

  useEffect(() => {
    const newParticles = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
      delay: Math.random() * 0.5,
      duration: 2 + Math.random() * 2,
    }));
    setParticles(newParticles);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute w-3 h-3 rounded-sm"
          style={{
            left: `${particle.x}%`,
            backgroundColor: particle.color,
            top: -20,
          }}
          initial={{ y: -20, rotate: 0, opacity: 1 }}
          animate={{
            y: '100vh',
            rotate: 720,
            opacity: [1, 1, 0],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            ease: 'easeIn',
          }}
        />
      ))}
    </div>
  );
}

export function ChallengeCompletion({
  open,
  onOpenChange,
  totalDays,
  totalPoints,
  longestStreak,
  completedTasksTotal,
  onStartNew,
}: ChallengeCompletionProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (open) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden">
        {showConfetti && <Confetti />}
        
        <DialogHeader className="text-center relative z-10">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', duration: 0.6 }}
            className="mx-auto mb-4"
          >
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <PartyPopper className="w-12 h-12 text-primary-foreground" />
            </div>
          </motion.div>
          
          <DialogTitle className="text-3xl font-display">
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-gradient"
            >
              Challenge Complete! 🎉
            </motion.span>
          </DialogTitle>
        </DialogHeader>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-4 relative z-10"
        >
          <p className="text-center text-muted-foreground">
            Congratulations! You've conquered the {totalDays}-day challenge. Your dedication and discipline are truly inspiring!
          </p>

          {/* Stats Summary */}
          <div className="grid grid-cols-2 gap-3 mt-6">
            <div className="bg-secondary/50 rounded-xl p-4 text-center">
              <Calendar className="w-6 h-6 mx-auto text-primary mb-2" />
              <div className="text-2xl font-display font-bold">{totalDays}</div>
              <div className="text-xs text-muted-foreground">Days Completed</div>
            </div>
            
            <div className="bg-secondary/50 rounded-xl p-4 text-center">
              <Trophy className="w-6 h-6 mx-auto text-yellow-500 mb-2" />
              <div className="text-2xl font-display font-bold">{totalPoints}</div>
              <div className="text-xs text-muted-foreground">Total Points</div>
            </div>
            
            <div className="bg-secondary/50 rounded-xl p-4 text-center">
              <Flame className="w-6 h-6 mx-auto text-orange-500 mb-2" />
              <div className="text-2xl font-display font-bold">{longestStreak}</div>
              <div className="text-xs text-muted-foreground">Longest Streak</div>
            </div>
            
            <div className="bg-secondary/50 rounded-xl p-4 text-center">
              <Target className="w-6 h-6 mx-auto text-green-500 mb-2" />
              <div className="text-2xl font-display font-bold">{completedTasksTotal}</div>
              <div className="text-xs text-muted-foreground">Tasks Completed</div>
            </div>
          </div>

          {/* Achievement Badge */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-6 p-4 rounded-xl bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 border border-primary/30 text-center"
          >
            <div className="flex items-center justify-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              <span className="font-display font-bold text-primary">Champion Status Achieved!</span>
              <Zap className="w-5 h-5 text-primary" />
            </div>
          </motion.div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-4">
            <Button onClick={onStartNew} className="w-full h-12">
              <RotateCcw className="w-5 h-5 mr-2" />
              Start New Challenge
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
              View Summary Later
            </Button>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
