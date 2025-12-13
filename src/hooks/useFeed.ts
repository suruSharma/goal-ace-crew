import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface FeedPost {
  id: string;
  user_id: string;
  post_type: string;
  content: any;
  message: string | null;
  created_at: string;
  user: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  reactions: {
    emoji: string;
    count: number;
    hasReacted: boolean;
  }[];
  comments: {
    id: string;
    user_id: string;
    content: string;
    created_at: string;
    user: {
      full_name: string;
      avatar_url: string | null;
    };
  }[];
  commentCount: number;
}

export function useFeed(userId: string | undefined) {
  const { toast } = useToast();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFeed = useCallback(async () => {
    if (!userId) return;
    
    try {
      // Get posts with user info - exclude task_completion posts
      const { data: postsData, error: postsError } = await (supabase
        .from('feed_posts' as any)
        .select(`
          id,
          user_id,
          post_type,
          content,
          message,
          created_at,
          profiles!feed_posts_user_id_fkey (
            id,
            full_name,
            avatar_url
          )
        `)
        .neq('post_type', 'task_completion')
        .order('created_at', { ascending: false })
        .limit(50) as any);

      if (postsError) throw postsError;

      if (!postsData || postsData.length === 0) {
        setPosts([]);
        return;
      }

      const postIds = postsData.map((p: any) => p.id);

      // Get reactions for all posts
      const { data: reactionsData } = await (supabase
        .from('feed_reactions' as any)
        .select('post_id, emoji, user_id')
        .in('post_id', postIds) as any);

      // Get comments for all posts
      const { data: commentsData } = await (supabase
        .from('feed_comments' as any)
        .select(`
          id,
          post_id,
          user_id,
          content,
          created_at,
          profiles!feed_comments_user_id_fkey (
            full_name,
            avatar_url
          )
        `)
        .in('post_id', postIds)
        .order('created_at', { ascending: true }) as any);

      // Process posts with reactions and comments
      const processedPosts: FeedPost[] = postsData.map((post: any) => {
        const postReactions = reactionsData?.filter(r => r.post_id === post.id) || [];
        const postComments = commentsData?.filter(c => c.post_id === post.id) || [];

        // Group reactions by emoji
        const reactionCounts: Record<string, { count: number; hasReacted: boolean }> = {};
        postReactions.forEach(r => {
          if (!reactionCounts[r.emoji]) {
            reactionCounts[r.emoji] = { count: 0, hasReacted: false };
          }
          reactionCounts[r.emoji].count++;
          if (r.user_id === userId) {
            reactionCounts[r.emoji].hasReacted = true;
          }
        });

        const reactions = Object.entries(reactionCounts).map(([emoji, data]) => ({
          emoji,
          count: data.count,
          hasReacted: data.hasReacted
        }));

        return {
          id: post.id,
          user_id: post.user_id,
          post_type: post.post_type,
          content: post.content,
          message: post.message,
          created_at: post.created_at,
          user: {
            id: post.profiles?.id || post.user_id,
            full_name: post.profiles?.full_name || 'Unknown',
            avatar_url: post.profiles?.avatar_url
          },
          reactions,
          comments: postComments.slice(0, 3).map((c: any) => ({
            id: c.id,
            user_id: c.user_id,
            content: c.content,
            created_at: c.created_at,
            user: {
              full_name: c.profiles?.full_name || 'Unknown',
              avatar_url: c.profiles?.avatar_url
            }
          })),
          commentCount: postComments.length
        };
      });

      setPosts(processedPosts);
    } catch (error) {
      console.error('Error fetching feed:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  // Real-time subscription for new posts
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('feed-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'feed_posts'
        },
        async (payload) => {
          // Fetch the complete post with profile info
          const newPostId = payload.new.id;
          const { data: postData } = await (supabase
            .from('feed_posts' as any)
            .select(`
              id,
              user_id,
              post_type,
              content,
              message,
              created_at,
              profiles!feed_posts_user_id_fkey (
                id,
                full_name,
                avatar_url
              )
            `)
            .eq('id', newPostId)
            .single() as any);

          // Skip task_completion posts in real-time updates
          if (postData && postData.post_type !== 'task_completion') {
            const newPost: FeedPost = {
              id: postData.id,
              user_id: postData.user_id,
              post_type: postData.post_type,
              content: postData.content,
              message: postData.message,
              created_at: postData.created_at,
              user: {
                id: postData.profiles?.id || postData.user_id,
                full_name: postData.profiles?.full_name || 'Unknown',
                avatar_url: postData.profiles?.avatar_url
              },
              reactions: [],
              comments: [],
              commentCount: 0
            };

            setPosts(prev => {
              // Check if post already exists
              if (prev.some(p => p.id === newPost.id)) return prev;
              return [newPost, ...prev];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const addReaction = async (postId: string, emoji: string) => {
    if (!userId) return;

    try {
      const { error } = await (supabase
        .from('feed_reactions' as any)
        .insert({
          post_id: postId,
          user_id: userId,
          emoji
        }) as any);

      if (error) {
        if (error.code === '23505') {
          // Already reacted, remove reaction
          await removeReaction(postId, emoji);
          return;
        }
        throw error;
      }

      // Optimistic update
      setPosts(prev => prev.map(post => {
        if (post.id !== postId) return post;
        
        const existingReaction = post.reactions.find(r => r.emoji === emoji);
        if (existingReaction) {
          return {
            ...post,
            reactions: post.reactions.map(r => 
              r.emoji === emoji 
                ? { ...r, count: r.count + 1, hasReacted: true }
                : r
            )
          };
        } else {
          return {
            ...post,
            reactions: [...post.reactions, { emoji, count: 1, hasReacted: true }]
          };
        }
      }));
    } catch (error: any) {
      toast({
        title: "Error adding reaction",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const removeReaction = async (postId: string, emoji: string) => {
    if (!userId) return;

    try {
      const { error } = await (supabase
        .from('feed_reactions' as any)
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId)
        .eq('emoji', emoji) as any);

      if (error) throw error;

      // Optimistic update
      setPosts(prev => prev.map(post => {
        if (post.id !== postId) return post;
        
        return {
          ...post,
          reactions: post.reactions
            .map(r => 
              r.emoji === emoji 
                ? { ...r, count: r.count - 1, hasReacted: false }
                : r
            )
            .filter(r => r.count > 0)
        };
      }));
    } catch (error: any) {
      toast({
        title: "Error removing reaction",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const addComment = async (postId: string, content: string) => {
    if (!userId || !content.trim()) return;

    try {
      const { data, error } = await (supabase
        .from('feed_comments' as any)
        .insert({
          post_id: postId,
          user_id: userId,
          content: content.trim()
        })
        .select(`
          id,
          user_id,
          content,
          created_at,
          profiles!feed_comments_user_id_fkey (
            full_name,
            avatar_url
          )
        `)
        .single() as any);

      if (error) throw error;

      // Optimistic update
      setPosts(prev => prev.map(post => {
        if (post.id !== postId) return post;
        
        const newComment = {
          id: data.id,
          user_id: data.user_id,
          content: data.content,
          created_at: data.created_at,
          user: {
            full_name: (data as any).profiles?.full_name || 'You',
            avatar_url: (data as any).profiles?.avatar_url
          }
        };

        return {
          ...post,
          comments: [...post.comments.slice(0, 2), newComment],
          commentCount: post.commentCount + 1
        };
      }));

      toast({
        title: "Comment added",
        description: "Your comment has been posted."
      });
    } catch (error: any) {
      toast({
        title: "Error adding comment",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const deleteComment = async (postId: string, commentId: string) => {
    try {
      const { error } = await (supabase
        .from('feed_comments' as any)
        .delete()
        .eq('id', commentId) as any);

      if (error) throw error;

      setPosts(prev => prev.map(post => {
        if (post.id !== postId) return post;
        
        return {
          ...post,
          comments: post.comments.filter(c => c.id !== commentId),
          commentCount: post.commentCount - 1
        };
      }));

      toast({
        title: "Comment deleted"
      });
    } catch (error: any) {
      toast({
        title: "Error deleting comment",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const createPost = async (
    postType: string, 
    content: any, 
    message?: string
  ) => {
    if (!userId) return;

    try {
      const { error } = await (supabase
        .from('feed_posts' as any)
        .insert({
          user_id: userId,
          post_type: postType,
          content,
          message
        }) as any);

      if (error) throw error;

      await fetchFeed();
    } catch (error: any) {
      console.error('Error creating post:', error);
    }
  };

  return {
    posts,
    loading,
    addReaction,
    removeReaction,
    addComment,
    deleteComment,
    createPost,
    refetch: fetchFeed
  };
}
