import { motion } from 'framer-motion';
import { Flame, Zap } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface StreakDisplayProps {
  currentStreak: number;
  longestStreak: number;
  loading?: boolean;
}

export function StreakDisplay({ currentStreak, longestStreak, loading }: StreakDisplayProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-6">
        <Skeleton className="h-12 w-24" />
        <Skeleton className="h-12 w-24" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-6">
      {/* Current Streak */}
      <motion.div 
        className="flex items-center gap-2"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
      >
        <div className={`p-2 rounded-lg ${currentStreak > 0 ? 'bg-orange-500/20' : 'bg-muted'}`}>
          <Flame className={`w-5 h-5 ${currentStreak > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
        </div>
        <div>
          <motion.span 
            className={`text-2xl font-display font-bold ${currentStreak > 0 ? 'text-orange-500' : 'text-muted-foreground'}`}
            key={currentStreak}
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
          >
            {currentStreak}
          </motion.span>
          <p className="text-xs text-muted-foreground">Day Streak</p>
        </div>
      </motion.div>

      {/* Longest Streak */}
      <motion.div 
        className="flex items-center gap-2"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
      >
        <div className={`p-2 rounded-lg ${longestStreak > 0 ? 'bg-primary/20' : 'bg-muted'}`}>
          <Zap className={`w-5 h-5 ${longestStreak > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
        </div>
        <div>
          <span className={`text-2xl font-display font-bold ${longestStreak > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
            {longestStreak}
          </span>
          <p className="text-xs text-muted-foreground">Best Streak</p>
        </div>
      </motion.div>
    </div>
  );
}
