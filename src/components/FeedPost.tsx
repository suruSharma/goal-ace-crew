import { useState } from 'react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { 
  CheckCircle2, Trophy, Scale, Flame, Target, Zap,
  MessageCircle, Send, Trash2, ChevronDown, ChevronUp
} from 'lucide-react';
import { FeedPost as FeedPostType } from '@/hooks/useFeed';

const REACTION_EMOJIS = ['❤️', '🔥', '💪', '👏', '🎉', '⭐'];

const getPostIcon = (type: string) => {
  switch (type) {
    case 'task_completion': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case 'achievement': return <Trophy className="w-4 h-4 text-yellow-500" />;
    case 'weight_log': return <Scale className="w-4 h-4 text-blue-500" />;
    case 'challenge_started': return <Flame className="w-4 h-4 text-orange-500" />;
    case 'challenge_completed': return <Target className="w-4 h-4 text-primary" />;
    case 'streak_milestone': return <Zap className="w-4 h-4 text-purple-500" />;
    case 'wall_message': return <MessageCircle className="w-4 h-4 text-primary" />;
    default: return <Flame className="w-4 h-4" />;
  }
};

const getPostTitle = (type: string, content: any) => {
  switch (type) {
    case 'task_completion':
      return `Completed ${content.taskCount || 1} task${(content.taskCount || 1) > 1 ? 's' : ''}`;
    case 'achievement':
      return `Unlocked achievement: ${content.name || 'Unknown'}`;
    case 'weight_log':
      return `Logged weight: ${content.weight || '?'} kg`;
    case 'challenge_started':
      return 'Started a new challenge!';
    case 'challenge_completed':
      return `Completed the ${content.days || 75} day challenge!`;
    case 'streak_milestone':
      return `Reached a ${content.days || '?'} day streak!`;
    case 'wall_message':
      return 'Left a message';
    default:
      return 'Activity';
  }
};

interface FeedPostProps {
  post: FeedPostType;
  currentUserId: string;
  wallOwnerId?: string;
  onReact: (postId: string, emoji: string) => void;
  onComment: (postId: string, content: string) => void;
  onDeleteComment: (postId: string, commentId: string) => void;
  onDeletePost?: (postId: string) => void;
}

export function FeedPostCard({ 
  post, 
  currentUserId, 
  wallOwnerId,
  onReact, 
  onComment,
  onDeleteComment,
  onDeletePost
}: FeedPostProps) {
  const [showComments, setShowComments] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Can delete if: own post OR wall message on your wall
  const canDelete = onDeletePost && (
    post.user_id === currentUserId || 
    (post.post_type === 'wall_message' && wallOwnerId === currentUserId)
  );
  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    setSubmitting(true);
    await onComment(post.id, newComment);
    setNewComment('');
    setSubmitting(false);
    setShowComments(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-start gap-3 mb-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={post.user.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {post.user.full_name?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold truncate">{post.user.full_name}</span>
                {getPostIcon(post.post_type)}
              </div>
              <p className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
              </p>
            </div>
            {canDelete && (
              <button
                onClick={() => onDeletePost(post.id)}
                className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                title="Delete post"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Content */}
          <div className="mb-3">
            <p className="font-medium">{getPostTitle(post.post_type, post.content)}</p>
            {post.message && (
              <p className="text-muted-foreground mt-1">{post.message}</p>
            )}
            {post.content.points && (
              <p className="text-sm text-primary mt-1">+{post.content.points} points</p>
            )}
          </div>

          {/* Reactions */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {post.reactions.map(reaction => (
              <button
                key={reaction.emoji}
                onClick={() => onReact(post.id, reaction.emoji)}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm transition-colors ${
                  reaction.hasReacted 
                    ? 'bg-primary/20 text-primary' 
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                <span>{reaction.emoji}</span>
                <span className="text-xs">{reaction.count}</span>
              </button>
            ))}
            
            <div className="relative">
              <button
                onClick={() => setShowReactions(!showReactions)}
                className="p-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors"
              >
                <span className="text-sm">+</span>
              </button>
              
              {showReactions && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute bottom-full left-0 mb-1 p-2 bg-card border border-border rounded-lg shadow-lg flex gap-1 z-10"
                >
                  {REACTION_EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => {
                        onReact(post.id, emoji);
                        setShowReactions(false);
                      }}
                      className="p-1 hover:bg-muted rounded transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </motion.div>
              )}
            </div>
          </div>

          {/* Comments Toggle */}
          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <MessageCircle className="w-4 h-4" />
            <span>{post.commentCount} comment{post.commentCount !== 1 ? 's' : ''}</span>
            {showComments ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {/* Comments Section */}
          {showComments && (
            <div className="space-y-3 border-t border-border pt-3">
              {post.comments.map(comment => (
                <div key={comment.id} className="flex gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={comment.user.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {comment.user.full_name?.charAt(0)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 bg-muted rounded-lg p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{comment.user.full_name}</span>
                      {comment.user_id === currentUserId && (
                        <button
                          onClick={() => onDeleteComment(post.id, comment.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <p className="text-sm">{comment.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}

              {/* Add Comment */}
              <div className="flex gap-2">
                <Input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  className="flex-1 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmitComment()}
                />
                <Button 
                  size="sm" 
                  onClick={handleSubmitComment}
                  disabled={!newComment.trim() || submitting}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
