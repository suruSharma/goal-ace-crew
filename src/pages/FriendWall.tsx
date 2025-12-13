import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useFriends } from '@/hooks/useFriends';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PageHeader } from '@/components/PageHeader';
import { SimpleLoadingSkeleton } from '@/components/PageLoadingSkeleton';
import { FeedPostCard } from '@/components/FeedPost';
import { useToast } from '@/hooks/use-toast';
import { 
  User, Send, Loader2, MessageSquare, Rss
} from 'lucide-react';
import { FeedPost } from '@/hooks/useFeed';

export default function FriendWall() {
  const { friendId } = useParams<{ friendId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { friends } = useFriends(user?.id);

  const [friendProfile, setFriendProfile] = useState<{
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Check if we're actually friends with this person
  const isFriend = friends.some(f => f.id === friendId);

  const fetchFriendData = useCallback(async () => {
    if (!friendId || !user) return;

    try {
      setLoading(true);

      // Fetch friend's profile using secure function
      const { data: profiles } = await supabase
        .rpc('get_profile_display_info', { user_id: friendId });

      if (profiles && profiles.length > 0) {
        setFriendProfile(profiles[0]);
      }

      // Fetch posts on friend's wall (posts BY the friend OR wall messages TO the friend)
      const { data: postsData } = await (supabase
        .from('feed_posts' as any)
        .select(`
          id,
          user_id,
          post_type,
          content,
          message,
          created_at
        `)
        .or(`user_id.eq.${friendId},and(post_type.eq.wall_message,content->>to_user_id.eq.${friendId})`)
        .order('created_at', { ascending: false })
        .limit(50) as any);

      if (postsData && postsData.length > 0) {
        const postIds = postsData.map((p: any) => p.id);
        const postUserIds = [...new Set(postsData.map((p: any) => p.user_id as string))] as string[];

        // Get post author profiles
        const { data: postAuthorProfiles } = postUserIds.length > 0
          ? await supabase.rpc('get_profiles_display_info', { user_ids: postUserIds })
          : { data: [] };

        const postAuthorMap: Record<string, any> = {};
        (postAuthorProfiles || []).forEach((p: any) => {
          postAuthorMap[p.id] = p;
        });

        // Get reactions
        const { data: reactionsData } = await (supabase
          .from('feed_reactions' as any)
          .select('post_id, emoji, user_id')
          .in('post_id', postIds) as any);

        // Get comments
        const { data: commentsData } = await (supabase
          .from('feed_comments' as any)
          .select('id, post_id, user_id, content, created_at')
          .in('post_id', postIds)
          .order('created_at', { ascending: true }) as any);

        // Get comment user profiles
        const commentUserIds = (commentsData || []).map((c: any) => c.user_id as string);
        const uniqueCommentUserIds = [...new Set(commentUserIds)] as string[];
        const { data: commentProfiles } = uniqueCommentUserIds.length > 0 
          ? await supabase.rpc('get_profiles_display_info', { user_ids: uniqueCommentUserIds })
          : { data: [] };

        const commentProfileMap: Record<string, any> = {};
        (commentProfiles || []).forEach((p: any) => {
          commentProfileMap[p.id] = p;
        });

        const processedPosts: FeedPost[] = postsData.map((post: any) => {
          const postReactions = reactionsData?.filter(r => r.post_id === post.id) || [];
          const postComments = commentsData?.filter(c => c.post_id === post.id) || [];

          const reactionCounts: Record<string, { count: number; hasReacted: boolean }> = {};
          postReactions.forEach(r => {
            if (!reactionCounts[r.emoji]) {
              reactionCounts[r.emoji] = { count: 0, hasReacted: false };
            }
            reactionCounts[r.emoji].count++;
            if (r.user_id === user?.id) {
              reactionCounts[r.emoji].hasReacted = true;
            }
          });

          const author = postAuthorMap[post.user_id];

          return {
            id: post.id,
            user_id: post.user_id,
            post_type: post.post_type,
            content: post.content,
            message: post.message,
            created_at: post.created_at,
            user: {
              id: post.user_id,
              full_name: author?.full_name || 'Unknown',
              avatar_url: author?.avatar_url
            },
            reactions: Object.entries(reactionCounts).map(([emoji, data]) => ({
              emoji,
              count: data.count,
              hasReacted: data.hasReacted
            })),
            comments: postComments.slice(0, 3).map((c: any) => ({
              id: c.id,
              user_id: c.user_id,
              content: c.content,
              created_at: c.created_at,
              user: {
                full_name: commentProfileMap[c.user_id]?.full_name || 'Unknown',
                avatar_url: commentProfileMap[c.user_id]?.avatar_url
              }
            })),
            commentCount: postComments.length
          };
        });

        setPosts(processedPosts);
      } else {
        setPosts([]);
      }
    } catch (error) {
      console.error('Error fetching friend data:', error);
    } finally {
      setLoading(false);
    }
  }, [friendId, user]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && friendId) {
      fetchFriendData();
    }
  }, [user, friendId, fetchFriendData]);

  const handlePostMessage = async () => {
    if (!newMessage.trim() || !user || !friendId) return;

    const messageText = newMessage.trim();
    setSubmitting(true);
    setNewMessage('');

    // Optimistic update - add the new post immediately
    const tempId = `temp-${Date.now()}`;
    const newPost: FeedPost = {
      id: tempId,
      user_id: user.id,
      post_type: 'wall_message',
      content: { to_user_id: friendId },
      message: messageText,
      created_at: new Date().toISOString(),
      user: {
        id: user.id,
        full_name: 'You',
        avatar_url: null
      },
      reactions: [],
      comments: [],
      commentCount: 0
    };
    setPosts(prev => [newPost, ...prev]);

    try {
      const { data, error } = await (supabase
        .from('feed_posts' as any)
        .insert({
          user_id: user.id,
          post_type: 'wall_message',
          content: { to_user_id: friendId },
          message: messageText
        })
        .select('id')
        .single() as any);

      if (error) throw error;

      // Update the temp post with real ID
      setPosts(prev => prev.map(p => 
        p.id === tempId ? { ...p, id: data.id } : p
      ));

      toast({
        title: "Message posted!",
        description: `Your message has been posted to ${friendProfile?.full_name}'s wall.`
      });
    } catch (error: any) {
      // Remove optimistic post on error
      setPosts(prev => prev.filter(p => p.id !== tempId));
      setNewMessage(messageText);
      toast({
        title: "Error posting message",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const addReaction = async (postId: string, emoji: string) => {
    if (!user) return;

    // Check if user already reacted with this emoji
    const post = posts.find(p => p.id === postId);
    const existingReaction = post?.reactions.find(r => r.emoji === emoji && r.hasReacted);

    if (existingReaction) {
      // Optimistic remove
      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p;
        return {
          ...p,
          reactions: p.reactions
            .map(r => r.emoji === emoji ? { ...r, count: r.count - 1, hasReacted: false } : r)
            .filter(r => r.count > 0)
        };
      }));

      try {
        await (supabase
          .from('feed_reactions' as any)
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id)
          .eq('emoji', emoji) as any);
      } catch (error: any) {
        // Revert on error
        setPosts(prev => prev.map(p => {
          if (p.id !== postId) return p;
          const existing = p.reactions.find(r => r.emoji === emoji);
          if (existing) {
            return {
              ...p,
              reactions: p.reactions.map(r => 
                r.emoji === emoji ? { ...r, count: r.count + 1, hasReacted: true } : r
              )
            };
          }
          return {
            ...p,
            reactions: [...p.reactions, { emoji, count: 1, hasReacted: true }]
          };
        }));
      }
    } else {
      // Optimistic add
      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p;
        const existing = p.reactions.find(r => r.emoji === emoji);
        if (existing) {
          return {
            ...p,
            reactions: p.reactions.map(r => 
              r.emoji === emoji ? { ...r, count: r.count + 1, hasReacted: true } : r
            )
          };
        }
        return {
          ...p,
          reactions: [...p.reactions, { emoji, count: 1, hasReacted: true }]
        };
      }));

      try {
        const { error } = await (supabase
          .from('feed_reactions' as any)
          .insert({
            post_id: postId,
            user_id: user.id,
            emoji
          }) as any);

        if (error && error.code !== '23505') throw error;
      } catch (error: any) {
        // Revert on error
        setPosts(prev => prev.map(p => {
          if (p.id !== postId) return p;
          return {
            ...p,
            reactions: p.reactions
              .map(r => r.emoji === emoji ? { ...r, count: r.count - 1, hasReacted: false } : r)
              .filter(r => r.count > 0)
          };
        }));
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
      }
    }
  };

  const addComment = async (postId: string, content: string) => {
    if (!user || !content.trim()) return;

    const commentText = content.trim();
    const tempId = `temp-comment-${Date.now()}`;

    // Optimistic update
    const newComment = {
      id: tempId,
      user_id: user.id,
      content: commentText,
      created_at: new Date().toISOString(),
      user: {
        full_name: 'You',
        avatar_url: null
      }
    };

    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      return {
        ...p,
        comments: [...p.comments.slice(-2), newComment],
        commentCount: p.commentCount + 1
      };
    }));

    try {
      const { data, error } = await (supabase
        .from('feed_comments' as any)
        .insert({
          post_id: postId,
          user_id: user.id,
          content: commentText
        })
        .select('id')
        .single() as any);

      if (error) throw error;

      // Update with real ID
      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p;
        return {
          ...p,
          comments: p.comments.map(c => c.id === tempId ? { ...c, id: data.id } : c)
        };
      }));

      toast({ title: "Comment added" });
    } catch (error: any) {
      // Revert on error
      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p;
        return {
          ...p,
          comments: p.comments.filter(c => c.id !== tempId),
          commentCount: p.commentCount - 1
        };
      }));
      toast({
        title: "Error adding comment",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const deleteComment = async (postId: string, commentId: string) => {
    // Store for potential revert
    const post = posts.find(p => p.id === postId);
    const comment = post?.comments.find(c => c.id === commentId);

    // Optimistic delete
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      return {
        ...p,
        comments: p.comments.filter(c => c.id !== commentId),
        commentCount: Math.max(0, p.commentCount - 1)
      };
    }));

    try {
      const { error } = await (supabase
        .from('feed_comments' as any)
        .delete()
        .eq('id', commentId) as any);

      if (error) throw error;

      toast({ title: "Comment deleted" });
    } catch (error: any) {
      // Revert on error
      if (comment) {
        setPosts(prev => prev.map(p => {
          if (p.id !== postId) return p;
          return {
            ...p,
            comments: [...p.comments, comment],
            commentCount: p.commentCount + 1
          };
        }));
      }
      toast({
        title: "Error deleting comment",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const deletePost = async (postId: string) => {
    // Store for potential revert
    const postToDelete = posts.find(p => p.id === postId);

    // Optimistic delete
    setPosts(prev => prev.filter(p => p.id !== postId));

    try {
      const { error } = await (supabase
        .from('feed_posts' as any)
        .delete()
        .eq('id', postId) as any);

      if (error) throw error;

      toast({ title: "Message deleted" });
    } catch (error: any) {
      // Revert on error
      if (postToDelete) {
        setPosts(prev => [postToDelete, ...prev].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ));
      }
      toast({
        title: "Error deleting message",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  if (authLoading || loading) {
    return <SimpleLoadingSkeleton />;
  }

  if (!isFriend && friendId !== user?.id) {
    return (
      <main className="container max-w-2xl mx-auto px-4 py-8">
        <PageHeader 
          title="Not Found" 
          icon={<User className="w-6 h-6 text-primary" />}
          showBackArrow
        />
        <Card className="mt-6">
          <CardContent className="py-12 text-center">
            <User className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold text-lg mb-2">User not found</h3>
            <p className="text-muted-foreground">
              You can only view walls of your friends.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="container max-w-2xl mx-auto px-4 py-8">
      <PageHeader 
        title={`${friendProfile?.full_name || 'Friend'}'s Wall`}
        icon={<User className="w-6 h-6 text-primary" />}
        showBackArrow
      />

      {/* Friend Profile Header */}
      <Card className="mt-6 mb-6">
        <CardContent className="py-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={friendProfile?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-xl">
                {friendProfile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-semibold">{friendProfile?.full_name}</h2>
              <p className="text-muted-foreground text-sm">Friend</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Post Message Form */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Leave a message</span>
          </div>
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={`Write something to ${friendProfile?.full_name}...`}
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handlePostMessage()}
            />
            <Button 
              onClick={handlePostMessage}
              disabled={!newMessage.trim() || submitting}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Posts */}
      <div className="space-y-4">
        {posts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Rss className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-semibold text-lg mb-2">No activity yet</h3>
              <p className="text-muted-foreground">
                Be the first to leave a message on {friendProfile?.full_name}'s wall!
              </p>
            </CardContent>
          </Card>
        ) : (
          posts.map((post) => (
            <FeedPostCard
              key={post.id}
              post={post}
              currentUserId={user?.id || ''}
              wallOwnerId={friendId}
              onReact={addReaction}
              onComment={addComment}
              onDeleteComment={deleteComment}
              onDeletePost={deletePost}
            />
          ))
        )}
      </div>
    </main>
  );
}