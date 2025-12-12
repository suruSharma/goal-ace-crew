import { motion } from 'framer-motion';

interface DayCounterProps {
  currentDay: number;
  totalDays?: number;
}

export function DayCounter({ currentDay, totalDays = 75 }: DayCounterProps) {
  return (
    <div className="text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="inline-flex items-baseline gap-2"
      >
        <span className="text-7xl md:text-8xl font-display font-bold text-gradient">
          {currentDay}
        </span>
        <span className="text-2xl md:text-3xl text-muted-foreground font-display">
          / {totalDays}
        </span>
      </motion.div>
      <p className="text-muted-foreground mt-2 text-lg">Days Completed</p>
    </div>
  );
}
