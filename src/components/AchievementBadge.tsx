import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { 
  Flame, Star, Trophy, Award, Medal, Crown, 
  Gem, Sparkles, CheckCircle, Zap, Rocket, Lock
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  flame: Flame,
  star: Star,
  trophy: Trophy,
  award: Award,
  medal: Medal,
  crown: Crown,
  gem: Gem,
  sparkles: Sparkles,
  'check-circle': CheckCircle,
  zap: Zap,
  rocket: Rocket,
};

const categoryColors: Record<string, string> = {
  streak: 'from-orange-500 to-red-500',
  points: 'from-yellow-500 to-amber-500',
  tasks: 'from-green-500 to-emerald-500',
  challenge: 'from-purple-500 to-violet-500',
};

interface AchievementBadgeProps {
  name: string;
  description: string;
  icon: string;
  category: string;
  unlocked: boolean;
  progress?: number;
  current?: number;
  requirement?: number;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  animate?: boolean;
}

export function AchievementBadge({
  name,
  description,
  icon,
  category,
  unlocked,
  progress = 0,
  current = 0,
  requirement = 0,
  size = 'md',
  showTooltip = true,
  animate = false,
}: AchievementBadgeProps) {
  const Icon = iconMap[icon] || Trophy;
  
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-20 h-20',
  };

  const iconSizes = {
    sm: 'w-5 h-5',
    md: 'w-7 h-7',
    lg: 'w-10 h-10',
  };

  const badge = (
    <motion.div
      initial={animate ? { scale: 0, rotate: -180 } : false}
      animate={animate ? { scale: 1, rotate: 0 } : false}
      transition={{ type: 'spring', duration: 0.6 }}
      className={cn(
        "relative rounded-full flex items-center justify-center",
        sizeClasses[size],
        unlocked 
          ? `bg-gradient-to-br ${categoryColors[category] || 'from-primary to-accent'} shadow-lg` 
          : 'bg-muted/50 border-2 border-dashed border-muted-foreground/30'
      )}
    >
      {unlocked ? (
        <Icon className={cn(iconSizes[size], 'text-white drop-shadow-md')} />
      ) : (
        <Lock className={cn(iconSizes[size], 'text-muted-foreground/50')} />
      )}
      
      {/* Progress ring for locked achievements */}
      {!unlocked && progress > 0 && size !== 'sm' && (
        <svg 
          className="absolute inset-0 -rotate-90" 
          viewBox="0 0 100 100"
        >
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            className="text-muted-foreground/20"
          />
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeDasharray={`${progress * 2.89} 289`}
            className="text-primary"
          />
        </svg>
      )}
    </motion.div>
  );

  if (!showTooltip) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {badge}
      </TooltipTrigger>
      <TooltipContent className="max-w-[200px]">
        <div className="space-y-1">
          <p className="font-semibold">{name}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
          {!unlocked && requirement > 0 && (
            <p className="text-xs text-primary font-medium">
              Progress: {current} / {requirement}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
