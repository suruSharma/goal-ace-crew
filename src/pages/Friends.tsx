import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useFriends } from '@/hooks/useFriends';
import { useFriendStreaks } from '@/hooks/useFriendStreaks';
import { useStreak } from '@/hooks/useStreak';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/PageHeader';
import { SimpleLoadingSkeleton } from '@/components/PageLoadingSkeleton';
import { FriendStreakComparison } from '@/components/FriendStreakComparison';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, Search, UserPlus, UserMinus, Check, X, 
  Loader2, Bell, UserCheck, Flame
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface SearchResult {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export default function Friends() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { 
    friends, 
    pendingRequests, 
    sentRequests, 
    loading, 
    sendFriendRequest, 
    acceptRequest, 
    rejectRequest, 
    removeFriend 
  } = useFriends(user?.id);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [activeChallengeId, setActiveChallengeId] = useState<string | undefined>();

  const friendIds = friends.map(f => f.id);
  const { streaks: friendStreaks, loading: streaksLoading } = useFriendStreaks(friendIds);
  const { currentStreak: myCurrentStreak, longestStreak: myLongestStreak } = useStreak(activeChallengeId);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Fetch profile and active challenge for streak comparison
  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .maybeSingle();
      if (profile) {
        setProfileName(profile.full_name || 'You');
        setAvatarUrl(profile.avatar_url);
      }
      const { data: challenge } = await supabase
        .from('user_challenges')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .is('group_id', null)
        .maybeSingle();
      setActiveChallengeId(challenge?.id);
    };
    fetchProfile();
  }, [user]);

  const searchUsers = async () => {
    if (!searchQuery.trim() || !user) return;
    
    setSearching(true);
    try {
      // Use security definer function that only returns safe fields (id, name, avatar)
      const { data, error } = await supabase
        .rpc('search_profiles_safe', { search_term: searchQuery.trim() });

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error: any) {
      toast({
        title: "Error searching users",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async (targetId: string) => {
    setProcessingId(targetId);
    await sendFriendRequest(targetId);
    setProcessingId(null);
  };

  const handleAcceptRequest = async (requestId: string) => {
    setProcessingId(requestId);
    await acceptRequest(requestId);
    setProcessingId(null);
  };

  const handleRejectRequest = async (requestId: string) => {
    setProcessingId(requestId);
    await rejectRequest(requestId);
    setProcessingId(null);
  };

  const handleRemoveFriend = async (friendshipId: string) => {
    setProcessingId(friendshipId);
    await removeFriend(friendshipId);
    setProcessingId(null);
  };

  const isFriend = (userId: string) => friends.some(f => f.id === userId);
  const hasSentRequest = (userId: string) => sentRequests.includes(userId);

  if (authLoading || loading) {
    return <SimpleLoadingSkeleton />;
  }

  return (
    <main className="container max-w-4xl mx-auto px-4 py-8">
      <PageHeader 
        title="Friends" 
        icon={<Users className="w-6 h-6 text-primary" />}
      >
        {pendingRequests.length > 0 && (
          <Badge variant="destructive" className="flex items-center gap-1">
            <Bell className="w-3 h-3" />
            {pendingRequests.length} pending
          </Badge>
        )}
      </PageHeader>

      <Tabs defaultValue="friends" className="mt-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="friends" className="gap-2">
            <UserCheck className="w-4 h-4" />
            Friends ({friends.length})
          </TabsTrigger>
          <TabsTrigger value="streaks" className="gap-2">
            <Flame className="w-4 h-4" />
            Streaks
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-2">
            <Bell className="w-4 h-4" />
            Requests ({pendingRequests.length})
          </TabsTrigger>
          <TabsTrigger value="search" className="gap-2">
            <Search className="w-4 h-4" />
            Find
          </TabsTrigger>
        </TabsList>

        {/* Friends List */}
        <TabsContent value="friends" className="mt-6 space-y-4">
          {friends.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-semibold text-lg">No friends yet</h3>
                <p className="text-muted-foreground mb-4">
                  Search for friends to connect with and see their progress!
                </p>
              </CardContent>
            </Card>
          ) : (
            <AnimatePresence>
              {friends.map((friend, index) => (
                <motion.div
                  key={friend.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card>
                    <CardContent className="py-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={friend.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {friend.full_name?.charAt(0)?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-semibold">{friend.full_name}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFriend(friend.friendshipId);
                          }}
                          disabled={processingId === friend.friendshipId}
                          className="text-destructive hover:text-destructive"
                        >
                          {processingId === friend.friendshipId ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <UserMinus className="w-4 h-4 mr-1" />
                              Remove
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </TabsContent>

        {/* Pending Requests */}
        <TabsContent value="requests" className="mt-6 space-y-4">
          {pendingRequests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Bell className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-semibold text-lg">No pending requests</h3>
                <p className="text-muted-foreground">
                  When someone sends you a friend request, it will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <AnimatePresence>
              {pendingRequests.map((request, index) => (
                <motion.div
                  key={request.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card>
                    <CardContent className="py-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={request.requester.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {request.requester.full_name?.charAt(0)?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-semibold">{request.requester.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleAcceptRequest(request.id)}
                            disabled={processingId === request.id}
                          >
                            {processingId === request.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Check className="w-4 h-4 mr-1" />
                                Accept
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRejectRequest(request.id)}
                            disabled={processingId === request.id}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </TabsContent>

        {/* Search Tab */}
        <TabsContent value="search" className="mt-6 space-y-4">
          <div className="flex gap-2">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name..."
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
            />
            <Button onClick={searchUsers} disabled={searching}>
              {searching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-3">
              {searchResults.map((result) => (
                <Card key={result.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={result.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {result.full_name?.charAt(0)?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{result.full_name}</p>
                      </div>
                      {isFriend(result.id) ? (
                        <Badge variant="secondary">Friends</Badge>
                      ) : hasSentRequest(result.id) ? (
                        <Badge variant="outline">Request Sent</Badge>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleSendRequest(result.id)}
                          disabled={processingId === result.id}
                        >
                          {processingId === result.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <UserPlus className="w-4 h-4 mr-1" />
                              Add
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {searchQuery && searchResults.length === 0 && !searching && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">No users found matching "{searchQuery}"</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </main>
  );
}
