import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { AppHeader } from '@/components/AppHeader';
import { LeaderboardCard } from '@/components/LeaderboardCard';
import { Badge } from '@/components/ui/badge';
import { SimpleLoadingSkeleton } from '@/components/PageLoadingSkeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Users, Clock, User, ListChecks, MessageSquare,
  Send, Loader2, Copy, LogOut, Trash2, Crown
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface GroupData {
  id: string;
  name: string;
  description: string;
  invite_code: string;
  created_by: string;
  status: string;
  total_days: number;
  created_at: string;
  owner_name: string;
  owner_avatar: string | null;
  member_count: number;
}

interface Task {
  id: string;
  name: string;
  description: string | null;
  weight: number;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
}

interface CheerData {
  emoji: string;
  count: number;
}

interface LeaderboardEntry {
  id: string;
  name: string;
  points: number;
  isCurrentUser: boolean;
  cheers?: CheerData[];
}

export default function GroupDetails() {
  const { groupId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<GroupData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && groupId) {
      fetchGroupDetails();
      fetchTasks();
      fetchLeaderboard();
      fetchComments();
    }
  }, [user, groupId]);

  const fetchGroupDetails = async () => {
    try {
      const { data: groupData, error } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .maybeSingle();

      if (error) throw error;
      if (!groupData) {
        navigate('/groups');
        return;
      }

      // Get owner info
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', groupData.created_by)
        .maybeSingle();

      // Get member count
      const { count } = await supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId);

      setGroup({
        ...groupData,
        owner_name: ownerProfile?.full_name || 'Unknown',
        owner_avatar: ownerProfile?.avatar_url || null,
        member_count: count || 0
      });
    } catch (error: any) {
      toast({
        title: "Error loading group",
        description: error.message,
        variant: "destructive"
      });
      navigate('/groups');
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async () => {
    try {
      // First try group-specific tasks
      let { data: groupTasks } = await supabase
        .from('challenges')
        .select('id, name, description, weight')
        .eq('group_id', groupId);

      // If no group tasks, get default tasks
      if (!groupTasks || groupTasks.length === 0) {
        const { data: defaultTasks } = await supabase
          .from('challenges')
          .select('id, name, description, weight')
          .eq('is_default', true);
        groupTasks = defaultTasks;
      }

      setTasks(groupTasks || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const { data: members } = await supabase
        .from('group_members')
        .select(`
          user_id,
          profiles (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('group_id', groupId);

      if (members) {
        const entries: LeaderboardEntry[] = await Promise.all(
          members.map(async (m: any) => {
            const { data: challenge } = await supabase
              .from('user_challenges')
              .select('id')
              .eq('user_id', m.user_id)
              .eq('is_active', true)
              .maybeSingle();

            let points = 0;
            if (challenge) {
              const { data: completedTasks } = await supabase
                .from('daily_tasks')
                .select(`completed, challenges (weight)`)
                .eq('user_challenge_id', challenge.id)
                .eq('completed', true);

              if (completedTasks) {
                points = completedTasks.reduce((sum: number, t: any) => 
                  sum + (t.challenges?.weight || 0), 0
                );
              }
            }

            // Fetch cheers
            const { data: cheersData } = await supabase
              .from('cheers')
              .select('emoji')
              .eq('to_user_id', m.user_id)
              .eq('group_id', groupId);

            const cheerCounts: Record<string, number> = {};
            if (cheersData) {
              cheersData.forEach((c: any) => {
                cheerCounts[c.emoji] = (cheerCounts[c.emoji] || 0) + 1;
              });
            }

            const cheers = Object.entries(cheerCounts)
              .map(([emoji, count]) => ({ emoji, count }))
              .sort((a, b) => b.count - a.count);

            return {
              id: m.user_id,
              name: m.profiles?.full_name || 'Unknown',
              avatar: m.profiles?.avatar_url || undefined,
              points,
              isCurrentUser: m.user_id === user!.id,
              cheers
            };
          })
        );

        entries.sort((a, b) => b.points - a.points);
        setLeaderboard(entries);
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    }
  };

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('group_comments')
        .select(`
          id,
          content,
          created_at,
          user_id,
          profiles (
            full_name,
            avatar_url
          )
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setComments((data || []).map((c: any) => ({
        id: c.id,
        content: c.content,
        created_at: c.created_at,
        user_id: c.user_id,
        user_name: c.profiles?.full_name || 'Unknown',
        user_avatar: c.profiles?.avatar_url || null
      })));
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    
    setSubmittingComment(true);
    try {
      const { error } = await supabase
        .from('group_comments')
        .insert({
          group_id: groupId,
          user_id: user!.id,
          content: newComment.trim()
        });

      if (error) throw error;

      setNewComment('');
      fetchComments();
      toast({ title: "Comment posted!" });
    } catch (error: any) {
      toast({
        title: "Error posting comment",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('group_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
      fetchComments();
    } catch (error: any) {
      toast({
        title: "Error deleting comment",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleLeaveGroup = async () => {
    setLeaving(true);
    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', user!.id);

      if (error) throw error;

      toast({ title: "Left group successfully" });
      navigate('/groups');
    } catch (error: any) {
      toast({
        title: "Error leaving group",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLeaving(false);
    }
  };

  const copyInviteCode = () => {
    if (group?.invite_code) {
      navigator.clipboard.writeText(group.invite_code);
      toast({ title: "Invite code copied!" });
    }
  };

  const handleCheer = async (toUserId: string, emoji: string) => {
    try {
      const { error } = await supabase
        .from('cheers')
        .insert({
          from_user_id: user!.id,
          to_user_id: toUserId,
          group_id: groupId,
          emoji
        });

      if (error) throw error;
      fetchLeaderboard();
    } catch (error: any) {
      toast({
        title: "Error sending cheer",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  if (authLoading || loading) {
    return <SimpleLoadingSkeleton />;
  }

  if (!group) {
    return null;
  }

  const isOwner = group.created_by === user?.id;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title={group.name}
        icon={<Users className="w-5 h-5 text-primary" />}
      />

      <main className="container max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Group Info Card */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h1 className="font-display text-2xl font-bold">{group.name}</h1>
                {group.status === 'draft' && (
                  <Badge variant="outline">Draft</Badge>
                )}
              </div>
              {group.description && (
                <p className="text-muted-foreground">{group.description}</p>
              )}
            </div>
            <div className="flex gap-2">
              {group.status === 'published' && (
                <Button variant="outline" size="sm" onClick={copyInviteCode}>
                  <Copy className="w-4 h-4 mr-1" />
                  Invite
                </Button>
              )}
              {!isOwner && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-destructive">
                      <LogOut className="w-4 h-4 mr-1" />
                      Leave
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Leave this group?</AlertDialogTitle>
                      <AlertDialogDescription>
                        You will no longer be able to see the leaderboard or participate in group discussions.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleLeaveGroup}
                        disabled={leaving}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {leaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Leave Group"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Crown className="w-4 h-4 text-primary" />
              <div>
                <p className="text-muted-foreground text-xs">Owner</p>
                <div className="flex items-center gap-1">
                  <Avatar className="w-5 h-5">
                    <AvatarImage src={group.owner_avatar || undefined} />
                    <AvatarFallback className="text-xs">
                      {group.owner_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{group.owner_name}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-primary" />
              <div>
                <p className="text-muted-foreground text-xs">Members</p>
                <span className="font-medium">{group.member_count}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-primary" />
              <div>
                <p className="text-muted-foreground text-xs">Duration</p>
                <span className="font-medium">{group.total_days} days</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <ListChecks className="w-4 h-4 text-primary" />
              <div>
                <p className="text-muted-foreground text-xs">Tasks</p>
                <span className="font-medium">{tasks.length}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Leaderboard */}
          <div className="space-y-0">
            <LeaderboardCard
              entries={leaderboard}
              title="Leaderboard"
              currentUserId={user?.id}
              groupId={groupId}
              showCheers={true}
            />
          </div>

          {/* Tasks */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <h2 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-primary" />
              Challenge Tasks
            </h2>
            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="p-3 rounded-lg bg-secondary/50 border border-border"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{task.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {task.weight}x points
                    </Badge>
                  </div>
                  {task.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {task.description}
                    </p>
                  )}
                </div>
              ))}
              {tasks.length === 0 && (
                <p className="text-muted-foreground text-center py-4 text-sm">
                  No tasks configured
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Comments Section */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <h2 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Discussion
          </h2>

          {/* Add Comment */}
          <div className="flex gap-2 mb-6">
            <Input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              className="bg-secondary/50"
              maxLength={500}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmitComment();
                }
              }}
            />
            <Button
              onClick={handleSubmitComment}
              disabled={submittingComment || !newComment.trim()}
            >
              {submittingComment ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Comments List */}
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarImage src={comment.user_avatar || undefined} />
                  <AvatarFallback className="text-xs">
                    {comment.user_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{comment.user_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(comment.created_at), 'MMM d, h:mm a')}
                    </span>
                    {comment.user_id === user?.id && (
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors ml-auto"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm mt-1 break-words">{comment.content}</p>
                </div>
              </div>
            ))}
            {comments.length === 0 && (
              <p className="text-muted-foreground text-center py-8 text-sm">
                No comments yet. Start the discussion!
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
