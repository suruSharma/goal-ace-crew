import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LeaderboardCard } from '@/components/LeaderboardCard';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, Plus, Users, Copy, LogOut, 
  Loader2, Trophy, UserPlus
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Group {
  id: string;
  name: string;
  description: string;
  invite_code: string;
  member_count: number;
}

interface LeaderboardEntry {
  id: string;
  name: string;
  points: number;
  isCurrentUser: boolean;
}

export default function Groups() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchGroups();
    }
  }, [user]);

  const fetchGroups = async () => {
    try {
      const { data: memberships } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user!.id);

      if (memberships && memberships.length > 0) {
        const groupIds = memberships.map(m => m.group_id);
        
        const { data: groups } = await supabase
          .from('groups')
          .select('*')
          .in('id', groupIds);

        if (groups) {
          const groupsWithCount = await Promise.all(groups.map(async (g) => {
            const { count } = await supabase
              .from('group_members')
              .select('*', { count: 'exact', head: true })
              .eq('group_id', g.id);
            
            return { ...g, member_count: count || 0 };
          }));
          
          setMyGroups(groupsWithCount);
          if (groupsWithCount.length > 0) {
            setSelectedGroup(groupsWithCount[0]);
            fetchLeaderboard(groupsWithCount[0].id);
          }
        }
      }
    } catch (error: any) {
      toast({
        title: "Error loading groups",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboard = async (groupId: string) => {
    try {
      const { data: members } = await supabase
        .from('group_members')
        .select(`
          user_id,
          profiles (
            id,
            full_name
          )
        `)
        .eq('group_id', groupId);

      if (members) {
        const entries: LeaderboardEntry[] = await Promise.all(
          members.map(async (m: any) => {
            // Get user's challenge
            const { data: challenge } = await supabase
              .from('user_challenges')
              .select('id')
              .eq('user_id', m.user_id)
              .eq('is_active', true)
              .maybeSingle();

            let points = 0;
            if (challenge) {
              // Get completed tasks with weights
              const { data: tasks } = await supabase
                .from('daily_tasks')
                .select(`
                  completed,
                  challenge_templates (weight)
                `)
                .eq('user_challenge_id', challenge.id)
                .eq('completed', true);

              if (tasks) {
                points = tasks.reduce((sum: number, t: any) => sum + (t.challenge_templates?.weight || 0), 0);
              }
            }

            return {
              id: m.user_id,
              name: m.profiles?.full_name || 'Unknown',
              points,
              isCurrentUser: m.user_id === user!.id
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

  const createGroup = async () => {
    if (!newGroupName.trim()) return;
    setCreating(true);

    try {
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: newGroupName,
          description: newGroupDesc,
          created_by: user!.id
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Join the group
      await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          user_id: user!.id
        });

      toast({
        title: "Group created!",
        description: `Invite code: ${group.invite_code}`
      });

      setCreateDialogOpen(false);
      setNewGroupName('');
      setNewGroupDesc('');
      fetchGroups();
    } catch (error: any) {
      toast({
        title: "Error creating group",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setCreating(false);
    }
  };

  const joinGroup = async () => {
    if (!joinCode.trim()) return;
    setJoining(true);

    try {
      const { data: group, error: findError } = await supabase
        .from('groups')
        .select('id, name')
        .eq('invite_code', joinCode.toLowerCase())
        .maybeSingle();

      if (findError || !group) {
        throw new Error('Invalid invite code');
      }

      const { error: joinError } = await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          user_id: user!.id
        });

      if (joinError) {
        if (joinError.code === '23505') {
          throw new Error('You are already a member of this group');
        }
        throw joinError;
      }

      toast({
        title: "Joined group!",
        description: `Welcome to ${group.name}`
      });

      setJoinDialogOpen(false);
      setJoinCode('');
      fetchGroups();
    } catch (error: any) {
      toast({
        title: "Error joining group",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setJoining(false);
    }
  };

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied!",
      description: "Invite code copied to clipboard"
    });
  };

  const leaveGroup = async (groupId: string) => {
    try {
      await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', user!.id);

      toast({
        title: "Left group",
        description: "You have left the group"
      });

      fetchGroups();
    } catch (error: any) {
      toast({
        title: "Error leaving group",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/dashboard">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <h1 className="font-display font-bold text-xl">Groups</h1>
          </div>
          
          <div className="flex gap-2">
            <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Join
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Join a Group</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Invite Code</Label>
                    <Input
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      placeholder="Enter invite code"
                      className="bg-secondary/50"
                    />
                  </div>
                  <Button onClick={joinGroup} className="w-full" disabled={joining}>
                    {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Join Group'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Create
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create a Group</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Group Name</Label>
                    <Input
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="My 75 Hard Squad"
                      className="bg-secondary/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description (optional)</Label>
                    <Input
                      value={newGroupDesc}
                      onChange={(e) => setNewGroupDesc(e.target.value)}
                      placeholder="We're crushing it together!"
                      className="bg-secondary/50"
                    />
                  </div>
                  <Button onClick={createGroup} className="w-full" disabled={creating}>
                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Group'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-8">
        {myGroups.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <Users className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="font-display text-2xl font-bold mb-2">No Groups Yet</h2>
            <p className="text-muted-foreground mb-6">
              Create a group or join one with an invite code to compete with friends!
            </p>
          </motion.div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {/* Groups List */}
            <div className="space-y-4">
              <h2 className="font-display font-semibold text-lg">My Groups</h2>
              {myGroups.map((group) => (
                <motion.div
                  key={group.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => {
                    setSelectedGroup(group);
                    fetchLeaderboard(group.id);
                  }}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedGroup?.id === group.id
                      ? 'bg-primary/10 border-primary/30'
                      : 'bg-card border-border hover:border-primary/30'
                  }`}
                >
                  <h3 className="font-semibold">{group.name}</h3>
                  <p className="text-sm text-muted-foreground">{group.member_count} members</p>
                  
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyInviteCode(group.invite_code);
                      }}
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      {group.invite_code}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        leaveGroup(group.id);
                      }}
                    >
                      <LogOut className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Leaderboard */}
            <div className="md:col-span-2">
              {selectedGroup && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <LeaderboardCard
                    entries={leaderboard}
                    title={`${selectedGroup.name} Leaderboard`}
                  />
                </motion.div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
