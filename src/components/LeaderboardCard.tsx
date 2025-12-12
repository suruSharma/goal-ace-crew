import { motion } from 'framer-motion';
import { Trophy, Medal, Award, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CheerButton } from './CheerButton';
import { Button } from './ui/button';

interface CheerData {
  emoji: string;
  count: number;
}

interface LeaderboardEntry {
  id: string;
  name: string;
  points: number;
  avatar?: string;
  isCurrentUser?: boolean;
  cheers?: CheerData[];
}

interface LeaderboardCardProps {
  entries: LeaderboardEntry[];
  title?: string;
  currentUserId?: string;
  groupId?: string;
  showCheers?: boolean;
  isGroupOwner?: boolean;
  onRemoveMember?: (userId: string, userName: string) => void;
}

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return <Trophy className="w-5 h-5 text-yellow-500" />;
    case 2:
      return <Medal className="w-5 h-5 text-gray-400" />;
    case 3:
      return <Award className="w-5 h-5 text-amber-600" />;
    default:
      return null;
  }
};

export function LeaderboardCard({ 
  entries, 
  title = "Leaderboard",
  currentUserId,
  groupId,
  showCheers = false,
  isGroupOwner = false,
  onRemoveMember
}: LeaderboardCardProps) {
  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <h3 className="font-display text-xl font-semibold mb-4">{title}</h3>
      <div className="space-y-3">
        {entries.map((entry, index) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={cn(
              "flex items-center gap-4 p-3 rounded-xl transition-colors",
              entry.isCurrentUser ? "bg-primary/10 border border-primary/30" : "bg-secondary/50"
            )}
          >
            <div className="w-8 flex justify-center">
              {getRankIcon(index + 1) || (
                <span className="text-muted-foreground font-medium">#{index + 1}</span>
              )}
            </div>
            
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center text-primary-foreground font-semibold overflow-hidden">
              {entry.avatar ? (
                <img src={entry.avatar} alt={entry.name} className="w-full h-full object-cover" />
              ) : (
                entry.name.charAt(0).toUpperCase()
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className={cn(
                "font-medium truncate",
                entry.isCurrentUser && "text-primary"
              )}>
                {entry.name}
                {entry.isCurrentUser && <span className="text-xs ml-2">(You)</span>}
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              {showCheers && currentUserId && groupId && (
                <CheerButton
                  fromUserId={currentUserId}
                  toUserId={entry.id}
                  toUserName={entry.name}
                  groupId={groupId}
                  existingCheers={entry.cheers}
                />
              )}
              <div className="text-right">
                <span className="font-display font-bold text-lg">{entry.points}</span>
                <span className="text-muted-foreground text-sm ml-1">pts</span>
              </div>
              {isGroupOwner && !entry.isCurrentUser && onRemoveMember && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => onRemoveMember(entry.id, entry.name)}
                >
                  <UserX className="w-4 h-4" />
                </Button>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
