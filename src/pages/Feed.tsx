import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useFeed } from '@/hooks/useFeed';
import { useFriends } from '@/hooks/useFriends';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { SimpleLoadingSkeleton } from '@/components/PageLoadingSkeleton';
import { FeedPostCard } from '@/components/FeedPost';
import { 
  Rss, Users, RefreshCw, UserPlus
} from 'lucide-react';

export default function Feed() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { posts, loading, addReaction, addComment, deleteComment, refetch } = useFeed(user?.id);
  const { friends } = useFriends(user?.id);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  if (authLoading || loading) {
    return <SimpleLoadingSkeleton />;
  }

  return (
    <main className="container max-w-2xl mx-auto px-4 py-8">
      <PageHeader 
        title="Activity Feed" 
        icon={<Rss className="w-6 h-6 text-primary" />}
      >
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={refetch}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/friends">
              <Users className="w-4 h-4 mr-2" />
              Friends ({friends.length})
            </Link>
          </Button>
        </div>
      </PageHeader>

      <div className="mt-6 space-y-4">
        {friends.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <UserPlus className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-semibold text-lg mb-2">No friends yet</h3>
              <p className="text-muted-foreground mb-4">
                Add friends to see their activity in your feed!
              </p>
              <Button asChild>
                <Link to="/friends">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Find Friends
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Rss className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-semibold text-lg mb-2">No activity yet</h3>
              <p className="text-muted-foreground">
                When you or your friends complete tasks, achievements, or log progress, it will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          posts.map((post) => (
            <FeedPostCard
              key={post.id}
              post={post}
              currentUserId={user?.id || ''}
              onReact={addReaction}
              onComment={addComment}
              onDeleteComment={deleteComment}
            />
          ))
        )}
      </div>
    </main>
  );
}
