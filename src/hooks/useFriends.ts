import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Friend {
  id: string;
  full_name: string;
  avatar_url: string | null;
  friendshipId: string;
}

export interface FriendRequest {
  id: string;
  requester: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  created_at: string;
}

export function useFriends(userId: string | undefined) {
  const { toast } = useToast();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFriends = useCallback(async () => {
    if (!userId) return;
    
    try {
      // Get accepted friendships where user is requester
      const { data: asRequester } = await (supabase
        .from('friendships' as any)
        .select(`
          id,
          addressee_id,
          profiles!friendships_addressee_id_fkey (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('requester_id', userId)
        .eq('status', 'accepted') as any);

      // Get accepted friendships where user is addressee
      const { data: asAddressee } = await (supabase
        .from('friendships' as any)
        .select(`
          id,
          requester_id,
          profiles!friendships_requester_id_fkey (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('addressee_id', userId)
        .eq('status', 'accepted') as any);

      const friendsList: Friend[] = [];
      
      if (asRequester) {
        asRequester.forEach((f: any) => {
          if (f.profiles) {
            friendsList.push({
              id: f.profiles.id,
              full_name: f.profiles.full_name || 'Unknown',
              avatar_url: f.profiles.avatar_url,
              friendshipId: f.id
            });
          }
        });
      }
      
      if (asAddressee) {
        asAddressee.forEach((f: any) => {
          if (f.profiles) {
            friendsList.push({
              id: f.profiles.id,
              full_name: f.profiles.full_name || 'Unknown',
              avatar_url: f.profiles.avatar_url,
              friendshipId: f.id
            });
          }
        });
      }

      setFriends(friendsList);
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  }, [userId]);

  const fetchPendingRequests = useCallback(async () => {
    if (!userId) return;
    
    try {
      const { data } = await (supabase
        .from('friendships' as any)
        .select(`
          id,
          created_at,
          profiles!friendships_requester_id_fkey (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('addressee_id', userId)
        .eq('status', 'pending') as any);

      if (data) {
        const requests: FriendRequest[] = data.map((r: any) => ({
          id: r.id,
          requester: {
            id: r.profiles?.id || '',
            full_name: r.profiles?.full_name || 'Unknown',
            avatar_url: r.profiles?.avatar_url
          },
          created_at: r.created_at
        }));
        setPendingRequests(requests);
      }
    } catch (error) {
      console.error('Error fetching pending requests:', error);
    }
  }, [userId]);

  const fetchSentRequests = useCallback(async () => {
    if (!userId) return;
    
    try {
      const { data } = await (supabase
        .from('friendships' as any)
        .select('addressee_id')
        .eq('requester_id', userId)
        .eq('status', 'pending') as any);

      if (data) {
        setSentRequests(data.map((r: any) => r.addressee_id));
      }
    } catch (error) {
      console.error('Error fetching sent requests:', error);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      setLoading(true);
      Promise.all([fetchFriends(), fetchPendingRequests(), fetchSentRequests()])
        .finally(() => setLoading(false));
    }
  }, [userId, fetchFriends, fetchPendingRequests, fetchSentRequests]);

  const sendFriendRequest = async (targetUserId: string) => {
    if (!userId) return false;
    
    try {
      const { error } = await (supabase
        .from('friendships' as any)
        .insert({
          requester_id: userId,
          addressee_id: targetUserId
        }) as any);

      if (error) {
        if (error.code === '23505') {
          toast({
            title: "Request already sent",
            description: "You've already sent a friend request to this user.",
            variant: "destructive"
          });
        } else {
          throw error;
        }
        return false;
      }

      toast({
        title: "Friend request sent!",
        description: "Waiting for them to accept."
      });
      
      setSentRequests(prev => [...prev, targetUserId]);
      return true;
    } catch (error: any) {
      toast({
        title: "Error sending request",
        description: error.message,
        variant: "destructive"
      });
      return false;
    }
  };

  const acceptRequest = async (friendshipId: string) => {
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
      
      await Promise.all([fetchFriends(), fetchPendingRequests()]);
      return true;
    } catch (error: any) {
      toast({
        title: "Error accepting request",
        description: error.message,
        variant: "destructive"
      });
      return false;
    }
  };

  const rejectRequest = async (friendshipId: string) => {
    try {
      const { error } = await (supabase
        .from('friendships' as any)
        .update({ status: 'rejected' })
        .eq('id', friendshipId) as any);

      if (error) throw error;

      toast({
        title: "Request rejected",
        description: "Friend request has been declined."
      });
      
      await fetchPendingRequests();
      return true;
    } catch (error: any) {
      toast({
        title: "Error rejecting request",
        description: error.message,
        variant: "destructive"
      });
      return false;
    }
  };

  const removeFriend = async (friendshipId: string) => {
    try {
      const { error } = await (supabase
        .from('friendships' as any)
        .delete()
        .eq('id', friendshipId) as any);

      if (error) throw error;

      toast({
        title: "Friend removed",
        description: "You are no longer friends."
      });
      
      await fetchFriends();
      return true;
    } catch (error: any) {
      toast({
        title: "Error removing friend",
        description: error.message,
        variant: "destructive"
      });
      return false;
    }
  };

  return {
    friends,
    pendingRequests,
    sentRequests,
    loading,
    sendFriendRequest,
    acceptRequest,
    rejectRequest,
    removeFriend,
    refetch: () => Promise.all([fetchFriends(), fetchPendingRequests(), fetchSentRequests()])
  };
}
