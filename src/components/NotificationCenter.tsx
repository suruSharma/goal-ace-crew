import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, UserPlus, Trophy, Check, X, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  type: 'friend_request' | 'achievement' | 'wall_message';
  title: string;
  description: string;
  created_at: string;
  data?: any;
}

interface NotificationCenterProps {
  userId: string;
}

export function NotificationCenter({ userId }: NotificationCenterProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const fetchNotifications = async () => {
    try {
      const notifs: Notification[] = [];

      // Fetch pending friend requests
      const { data: friendRequests } = await (supabase
        .from('friendships' as any)
        .select('id, created_at, requester_id')
        .eq('addressee_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }) as any);

      if (friendRequests && friendRequests.length > 0) {
        const requesterIds = friendRequests.map((r: any) => r.requester_id);
        const { data: profiles } = await supabase
          .rpc('get_profiles_display_info', { user_ids: requesterIds });

        const profileMap: Record<string, any> = {};
        (profiles || []).forEach((p: any) => {
          profileMap[p.id] = p;
        });

        friendRequests.forEach((req: any) => {
          notifs.push({
            id: `friend_${req.id}`,
            type: 'friend_request' as const,
            title: 'Friend Request',
            description: `${profileMap[req.requester_id]?.full_name || 'Someone'} wants to be your friend`,
            created_at: req.created_at,
            data: { 
              friendshipId: req.id, 
              requesterId: req.requester_id,
              requesterName: profileMap[req.requester_id]?.full_name 
            }
          });
        });
      }

      // Fetch wall messages TO this user (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: wallMessages } = await (supabase
        .from('feed_posts' as any)
        .select('id, created_at, user_id, message')
        .eq('post_type', 'wall_message')
        .neq('user_id', userId) // Not from themselves
        .gte('created_at', oneDayAgo)
        .order('created_at', { ascending: false })
        .limit(10) as any);

      if (wallMessages && wallMessages.length > 0) {
        // Filter to only messages TO this user (check content->to_user_id)
        const { data: wallMessagesFiltered } = await (supabase
          .from('feed_posts' as any)
          .select('id, created_at, user_id, message, content')
          .eq('post_type', 'wall_message')
          .neq('user_id', userId)
          .gte('created_at', oneDayAgo)
          .order('created_at', { ascending: false })
          .limit(10) as any);

        const messagesForUser = (wallMessagesFiltered || []).filter((m: any) => 
          m.content?.to_user_id === userId
        );

        if (messagesForUser.length > 0) {
          const senderIds = [...new Set(messagesForUser.map((m: any) => m.user_id as string))] as string[];
          const { data: senderProfiles } = await supabase
            .rpc('get_profiles_display_info', { user_ids: senderIds });

          const senderMap: Record<string, any> = {};
          (senderProfiles || []).forEach((p: any) => {
            senderMap[p.id] = p;
          });

          messagesForUser.forEach((msg: any) => {
            notifs.push({
              id: `wall_${msg.id}`,
              type: 'wall_message' as const,
              title: 'New Wall Message',
              description: `${senderMap[msg.user_id]?.full_name || 'Someone'} left a message on your wall`,
              created_at: msg.created_at,
              data: { 
                postId: msg.id,
                senderId: msg.user_id,
                senderName: senderMap[msg.user_id]?.full_name
              }
            });
          });
        }
      }

      // Sort by date
      notifs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setNotifications(notifs);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchNotifications();

      // Subscribe to real-time friend request changes
      const friendChannel = supabase
        .channel('friend-notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'friendships',
            filter: `addressee_id=eq.${userId}`
          },
          async (payload: any) => {
            const requesterId = payload.new?.requester_id;
            let requesterName = 'Someone';
            
            if (requesterId) {
              const { data: profiles } = await supabase
                .rpc('get_profiles_display_info', { user_ids: [requesterId] });
              if (profiles && profiles.length > 0) {
                requesterName = profiles[0].full_name || 'Someone';
              }
            }
            
            fetchNotifications();
            toast({
              title: "New Friend Request!",
              description: `${requesterName} wants to be your friend.`
            });
          }
        )
        .subscribe();

      // Subscribe to wall messages
      const wallChannel = supabase
        .channel('wall-notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'feed_posts'
          },
          async (payload: any) => {
            // Check if it's a wall message to this user
            if (payload.new?.post_type === 'wall_message' && 
                payload.new?.content?.to_user_id === userId &&
                payload.new?.user_id !== userId) {
              const senderId = payload.new?.user_id;
              let senderName = 'Someone';
              
              if (senderId) {
                const { data: profiles } = await supabase
                  .rpc('get_profiles_display_info', { user_ids: [senderId] });
                if (profiles && profiles.length > 0) {
                  senderName = profiles[0].full_name || 'Someone';
                }
              }
              
              fetchNotifications();
              toast({
                title: "New Wall Message!",
                description: `${senderName} left a message on your wall.`
              });
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(friendChannel);
        supabase.removeChannel(wallChannel);
      };
    }
  }, [userId]);

  const handleAcceptRequest = async (friendshipId: string) => {
    try {
      const { error } = await (supabase
        .from('friendships' as any)
        .update({ status: 'accepted' })
        .eq('id', friendshipId) as any);

      if (error) throw error;

      toast({
        title: "Friend request accepted!",
        description: "You are now friends."
      });

      setNotifications(prev => prev.filter(n => n.data?.friendshipId !== friendshipId));
    } catch (error: any) {
      toast({
        title: "Error accepting request",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleRejectRequest = async (friendshipId: string) => {
    try {
      const { error } = await (supabase
        .from('friendships' as any)
        .update({ status: 'rejected' })
        .eq('id', friendshipId) as any);

      if (error) throw error;

      toast({
        title: "Request declined"
      });

      setNotifications(prev => prev.filter(n => n.data?.friendshipId !== friendshipId));
    } catch (error: any) {
      toast({
        title: "Error declining request",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const unreadCount = notifications.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b border-border">
          <h3 className="font-semibold">Notifications</h3>
        </div>
        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No new notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notif) => (
                <div key={notif.id} className="p-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                      notif.type === 'friend_request' ? "bg-primary/10 text-primary" : 
                      notif.type === 'wall_message' ? "bg-blue-500/10 text-blue-500" : 
                      "bg-amber-500/10 text-amber-500"
                    )}>
                      {notif.type === 'friend_request' ? (
                        <UserPlus className="w-4 h-4" />
                      ) : notif.type === 'wall_message' ? (
                        <MessageSquare className="w-4 h-4" />
                      ) : (
                        <Trophy className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{notif.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{notif.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                      </p>
                      
                      {notif.type === 'friend_request' && (
                        <div className="flex gap-2 mt-2">
                          <Button 
                            size="sm" 
                            variant="default"
                            className="h-7 text-xs"
                            onClick={() => handleAcceptRequest(notif.data.friendshipId)}
                          >
                            <Check className="w-3 h-3 mr-1" />
                            Accept
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => handleRejectRequest(notif.data.friendshipId)}
                          >
                            <X className="w-3 h-3 mr-1" />
                            Decline
                          </Button>
                        </div>
                      )}
                      
                      {notif.type === 'wall_message' && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="h-7 text-xs mt-2"
                          onClick={() => {
                            navigate(`/friends/${userId}`);
                            setOpen(false);
                          }}
                        >
                          View Wall
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        {notifications.length > 0 && (
          <div className="p-2 border-t border-border">
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full text-xs" 
              asChild
              onClick={() => setOpen(false)}
            >
              <Link to="/friends">View all friend requests</Link>
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}