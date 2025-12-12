import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AchievementBadge } from './AchievementBadge';
import { Button } from '@/components/ui/button';
import { Trophy, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  requirement_type: string;
  requirement_value: number;
  points: number;
  current?: number;
  progress?: number;
  unlocked?: boolean;
}

interface AchievementsDisplayProps {
  achievements: Achievement[];
  unlockedCount: number;
  totalCount: number;
  compact?: boolean;
}

export function AchievementsDisplay({
  achievements,
  unlockedCount,
  totalCount,
  compact = false,
}: AchievementsDisplayProps) {
  const [expanded, setExpanded] = useState(false);
  
  const unlocked = achievements.filter(a => a.unlocked);
  const locked = achievements.filter(a => !a.unlocked);
  
  const displayedAchievements = compact && !expanded 
    ? [...unlocked.slice(0, 4), ...locked.slice(0, 4 - Math.min(unlocked.length, 4))]
    : achievements;

  const categories = ['streak', 'points', 'tasks', 'challenge'];
  const categoryNames: Record<string, string> = {
    streak: '🔥 Streak',
    points: '⭐ Points',
    tasks: '✅ Tasks',
    challenge: '🏆 Challenge',
  };

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            <span className="font-semibold">Achievements</span>
          </div>
          <span className="text-sm text-muted-foreground">
            {unlockedCount} / {totalCount}
          </span>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {displayedAchievements.map((achievement) => (
            <AchievementBadge
              key={achievement.id}
              name={achievement.name}
              description={achievement.description}
              icon={achievement.icon}
              category={achievement.category}
              unlocked={achievement.unlocked || false}
              progress={achievement.progress}
              current={achievement.current}
              requirement={achievement.requirement_value}
              size="sm"
            />
          ))}
        </div>

        {totalCount > 8 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="w-4 h-4 mr-1" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-1" />
                View All ({totalCount})
              </>
            )}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-6 h-6 text-primary" />
          <h3 className="font-display text-xl font-bold">Achievements</h3>
        </div>
        <span className="text-muted-foreground">
          {unlockedCount} / {totalCount} unlocked
        </span>
      </div>

      {categories.map((category) => {
        const categoryAchievements = achievements.filter(a => a.category === category);
        if (categoryAchievements.length === 0) return null;

        return (
          <div key={category} className="space-y-3">
            <h4 className="font-semibold text-sm text-muted-foreground">
              {categoryNames[category]}
            </h4>
            <div className="flex flex-wrap gap-3">
              <AnimatePresence>
                {categoryAchievements.map((achievement, index) => (
                  <motion.div
                    key={achievement.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <AchievementBadge
                      name={achievement.name}
                      description={achievement.description}
                      icon={achievement.icon}
                      category={achievement.category}
                      unlocked={achievement.unlocked || false}
                      progress={achievement.progress}
                      current={achievement.current}
                      requirement={achievement.requirement_value}
                      size="md"
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        );
      })}
    </div>
  );
}
