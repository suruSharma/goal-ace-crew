import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PageLoadingSkeleton } from '@/components/PageLoadingSkeleton';
import { PageHeader } from '@/components/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Trophy, Medal, Crown, 
  Calendar, CalendarDays, History,
  Users, User
} from 'lucide-react';

interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  total_points: number;
  achievement_count: number;
}

interface GroupLeaderboardEntry {
  id: string;
  name: string;
  member_count: number;
  total_points: number;
}

const TIME_PERIODS = [
  { id: 'weekly', label: 'This Week', icon: Calendar },
  { id: 'monthly', label: 'This Month', icon: CalendarDays },
  { id: 'all', label: 'All Time', icon: History },
];

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return <Crown className="w-5 h-5 text-yellow-500" />;
    case 2:
      return <Medal className="w-5 h-5 text-slate-400" />;
    case 3:
      return <Medal className="w-5 h-5 text-amber-600" />;
    default:
      return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-muted-foreground">{rank}</span>;
  }
};

const getRankStyles = (rank: number) => {
  switch (rank) {
    case 1:
      return 'border-yellow-500/30 bg-yellow-500/5';
    case 2:
      return 'border-slate-400/30 bg-slate-400/5';
    case 3:
      return 'border-amber-600/30 bg-amber-600/5';
    default:
      return 'border-border';
  }
};

export default function AchievementLeaderboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [selectedPeriod, setSelectedPeriod] = useState('weekly');
  const [leaderboardType, setLeaderboardType] = useState<'users' | 'groups'>('users');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [groupLeaderboard, setGroupLeaderboard] = useState<GroupLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRank, setUserRank] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      if (leaderboardType === 'users') {
        fetchLeaderboard();
      } else {
        fetchGroupLeaderboard();
      }
    }
  }, [user, selectedPeriod, leaderboardType]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('get_achievement_leaderboard', { time_period: selectedPeriod });

      if (error) throw error;

      if (data) {
        setLeaderboard(data);
        // Find current user's rank
        const rank = data.findIndex((entry: LeaderboardEntry) => entry.user_id === user?.id);
        setUserRank(rank >= 0 ? rank + 1 : null);
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupLeaderboard = async () => {
    setLoading(true);
    try {
      // Get all published groups
      const { data: groups, error: groupsError } = await supabase
        .from('groups')
        .select('id, name')
        .eq('status', 'published');

      if (groupsError) throw groupsError;

      if (groups) {
        // Calculate total points for each group
        const groupsWithStats: GroupLeaderboardEntry[] = await Promise.all(
          groups.map(async (group) => {
            // Get member count
            const { count: memberCount } = await supabase
              .from('group_members')
              .select('*', { count: 'exact', head: true })
              .eq('group_id', group.id);

            // Get all members' user IDs
            const { data: members } = await supabase
              .from('group_members')
              .select('user_id')
              .eq('group_id', group.id);

            let totalPoints = 0;
            if (members && members.length > 0) {
              const memberIds = members.map(m => m.user_id);

              // Get group's task templates
              const { data: groupTemplates } = await supabase
                .from('challenges')
                .select('id')
                .eq('group_id', group.id);

              let templateIds: string[] = [];
              if (groupTemplates && groupTemplates.length > 0) {
                templateIds = groupTemplates.map(t => t.id);
              } else {
                const { data: defaultTemplates } = await supabase
                  .from('challenges')
                  .select('id')
                  .eq('is_default', true);
                templateIds = defaultTemplates?.map(t => t.id) || [];
              }

              // Get all challenges for this group
              const { data: challenges } = await supabase
                .from('user_challenges')
                .select('id')
                .eq('group_id', group.id)
                .eq('is_active', true);

              if (challenges && challenges.length > 0 && templateIds.length > 0) {
                const challengeIds = challenges.map(c => c.id);

                // Get completed tasks for these challenges
                const { data: completedTasks } = await supabase
                  .from('daily_tasks')
                  .select('challenges (weight)')
                  .in('user_challenge_id', challengeIds)
                  .in('template_id', templateIds)
                  .eq('completed', true);

                if (completedTasks) {
                  totalPoints = completedTasks.reduce((sum: number, t: any) => 
                    sum + (t.challenges?.weight || 0), 0
                  );
                }
              }
            }

            return {
              id: group.id,
              name: group.name,
              member_count: memberCount || 0,
              total_points: totalPoints
            };
          })
        );

        // Sort by total points descending
        groupsWithStats.sort((a, b) => b.total_points - a.total_points);
        setGroupLeaderboard(groupsWithStats.filter(g => g.total_points > 0));
      }
    } catch (error) {
      console.error('Error fetching group leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return <PageLoadingSkeleton />;
  }

  const currentUserEntry = leaderboard.find(entry => entry.user_id === user?.id);

  return (
    <>
      <main className="container max-w-4xl mx-auto px-4 py-8 space-y-6">
        <PageHeader 
          title="Leaderboard" 
          icon={<Trophy className="w-6 h-6 text-primary" />}
        />

        {/* Leaderboard Type Tabs */}
        <Tabs value={leaderboardType} onValueChange={(v) => setLeaderboardType(v as 'users' | 'groups')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users" className="gap-2">
              <User className="w-4 h-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="groups" className="gap-2">
              <Users className="w-4 h-4" />
              Groups
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4 mt-4">
            {/* Time Period Filters */}
            <div className="flex flex-wrap gap-2">
              {TIME_PERIODS.map(period => {
                const Icon = period.icon;
                const isSelected = selectedPeriod === period.id;
                return (
                  <Button
                    key={period.id}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedPeriod(period.id)}
                    className="gap-2"
                  >
                    <Icon className="w-4 h-4" />
                    {period.label}
                  </Button>
                );
              })}
            </div>

            {/* Your Rank Card */}
            {currentUserEntry && userRank && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        {getRankIcon(userRank)}
                      </div>
                      <div>
                        <p className="font-semibold">Your Rank</p>
                        <p className="text-sm text-muted-foreground">
                          #{userRank} of {leaderboard.length} users
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-xl text-primary">{currentUserEntry.total_points}</p>
                      <p className="text-sm text-muted-foreground">{currentUserEntry.achievement_count} badges</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* User Leaderboard List */}
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-muted" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-muted rounded w-1/3" />
                          <div className="h-3 bg-muted rounded w-1/4" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : leaderboard.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Trophy className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="font-semibold text-lg">No achievements yet</h3>
                  <p className="text-muted-foreground">
                    {selectedPeriod === 'weekly' 
                      ? 'No one has unlocked achievements this week yet. Be the first!'
                      : selectedPeriod === 'monthly'
                      ? 'No achievements unlocked this month yet.'
                      : 'Start completing tasks to unlock achievements!'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {leaderboard.map((entry, index) => {
                    const rank = index + 1;
                    const isCurrentUser = entry.user_id === user?.id;
                    
                    return (
                      <motion.div
                        key={entry.user_id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card className={`${getRankStyles(rank)} ${isCurrentUser ? 'ring-2 ring-primary/50' : ''}`}>
                          <CardContent className="py-4">
                            <div className="flex items-center gap-4">
                              {/* Rank */}
                              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                {getRankIcon(rank)}
                              </div>
                              
                              {/* Avatar & Name */}
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={entry.avatar_url || undefined} />
                                <AvatarFallback className="bg-primary/10 text-primary">
                                  {entry.display_name?.charAt(0)?.toUpperCase() || 'A'}
                                </AvatarFallback>
                              </Avatar>
                              
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold">
                                    {entry.display_name}
                                    {isCurrentUser && (
                                      <Badge variant="secondary" className="ml-2 text-xs">You</Badge>
                                    )}
                                  </p>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {entry.achievement_count} achievement{entry.achievement_count !== 1 ? 's' : ''}
                                </p>
                              </div>
                              
                              {/* Points */}
                              <div className="text-right">
                                <p className="font-bold text-lg">{entry.total_points}</p>
                                <p className="text-xs text-muted-foreground">points</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>

          <TabsContent value="groups" className="space-y-4 mt-4">
            {/* Groups Leaderboard */}
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-muted" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-muted rounded w-1/3" />
                          <div className="h-3 bg-muted rounded w-1/4" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : groupLeaderboard.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="font-semibold text-lg">No groups yet</h3>
                  <p className="text-muted-foreground">
                    Groups will appear here once members start completing tasks.
                  </p>
                  <Button asChild className="mt-4">
                    <Link to="/groups">Browse Groups</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {groupLeaderboard.map((group, index) => {
                    const rank = index + 1;
                    
                    return (
                      <motion.div
                        key={group.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Link to={`/groups/${group.id}`}>
                          <Card className={`${getRankStyles(rank)} hover:border-accent/50 transition-colors cursor-pointer`}>
                            <CardContent className="py-4">
                              <div className="flex items-center gap-4">
                                {/* Rank */}
                                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                  {getRankIcon(rank)}
                                </div>
                                
                                {/* Group Icon */}
                                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                                  <Users className="w-5 h-5 text-accent" />
                                </div>
                                
                                <div className="flex-1">
                                  <p className="font-semibold">{group.name}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {group.member_count} member{group.member_count !== 1 ? 's' : ''}
                                  </p>
                                </div>
                                
                                {/* Points */}
                                <div className="text-right">
                                  <p className="font-bold text-lg text-accent">{group.total_points}</p>
                                  <p className="text-xs text-muted-foreground">total points</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}
