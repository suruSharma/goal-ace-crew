import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Flame, Trophy, Zap } from 'lucide-react';
import { Friend } from '@/hooks/useFriends';
import { FriendStreak } from '@/hooks/useFriendStreaks';
import { Skeleton } from '@/components/ui/skeleton';

interface StreakEntry {
  id: string;
  name: string;
  avatar_url: string | null;
  current_streak: number;
  longest_streak: number;
  isYou: boolean;
}

interface Props {
  friends: Friend[];
  friendStreaks: FriendStreak[];
  myCurrentStreak: number;
  myLongestStreak: number;
  userName: string;
  userAvatar: string | null;
  loading: boolean;
}

export function FriendStreakComparison({
  friends,
  friendStreaks,
  myCurrentStreak,
  myLongestStreak,
  userName,
  userAvatar,
  loading,
}: Props) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  // Build combined list
  const entries: StreakEntry[] = [
    {
      id: 'you',
      name: userName || 'You',
      avatar_url: userAvatar,
      current_streak: myCurrentStreak,
      longest_streak: myLongestStreak,
      isYou: true,
    },
    ...friends.map((f) => {
      const streak = friendStreaks.find((s) => s.user_id === f.id);
      return {
        id: f.id,
        name: f.full_name,
        avatar_url: f.avatar_url,
        current_streak: streak?.current_streak ?? 0,
        longest_streak: streak?.longest_streak ?? 0,
        isYou: false,
      };
    }),
  ];

  // Sort by current streak descending
  entries.sort((a, b) => b.current_streak - a.current_streak);

  const maxStreak = Math.max(...entries.map((e) => e.current_streak), 1);

  if (friends.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Flame className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-semibold text-lg">No friends to compare</h3>
          <p className="text-muted-foreground">
            Add friends to see how your streak compares!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry, index) => {
        const barWidth = maxStreak > 0 ? (entry.current_streak / maxStreak) * 100 : 0;
        const isLeader = index === 0 && entry.current_streak > 0;

        return (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.06 }}
          >
            <Card className={entry.isYou ? 'border-primary/50 bg-primary/5' : ''}>
              <CardContent className="py-4">
                <div className="flex items-center gap-3 mb-2">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={entry.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {entry.name?.charAt(0)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold truncate">
                        {entry.isYou ? 'You' : entry.name}
                      </p>
                      {entry.isYou && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          You
                        </Badge>
                      )}
                      {isLeader && (
                        <Trophy className="w-4 h-4 text-yellow-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      Best: {entry.longest_streak} days
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-right shrink-0">
                    <Flame className="w-5 h-5 text-orange-500" />
                    <span className="font-bold text-lg">{entry.current_streak}</span>
                    <span className="text-xs text-muted-foreground">days</span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${
                      entry.isYou
                        ? 'bg-primary'
                        : isLeader
                          ? 'bg-yellow-500'
                          : 'bg-muted-foreground/40'
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${barWidth}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: index * 0.06 }}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
