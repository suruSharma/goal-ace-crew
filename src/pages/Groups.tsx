import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LeaderboardCard } from '@/components/LeaderboardCard';
import { TaskConfigDialog } from '@/components/TaskConfigDialog';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, Plus, Users, Copy, LogOut, 
  Loader2, UserPlus, Settings2, Zap, ListChecks,
  Search, Eye, X, Send, Clock
} from 'lucide-react';
import { AppHeader } from '@/components/AppHeader';
import { Badge } from '@/components/ui/badge';
import { SimpleLoadingSkeleton } from '@/components/PageLoadingSkeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

interface Group {
  id: string;
  name: string;
  description: string;
  invite_code: string;
  created_by: string;
  member_count: number;
  status: 'draft' | 'published';
}

interface SearchGroup {
  id: string;
  name: string;
  description: string;
  member_count: number;
  tasks: { name: string; weight: number }[];
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
  const [newGroupDays, setNewGroupDays] = useState(75);
  const [useDefaultTasks, setUseDefaultTasks] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [newGroupId, setNewGroupId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchGroup[]>([]);
  const [searching, setSearching] = useState(false);
  const [previewGroup, setPreviewGroup] = useState<SearchGroup | null>(null);

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
          const groupsWithCount: Group[] = await Promise.all(groups.map(async (g) => {
            const { count } = await supabase
              .from('group_members')
              .select('*', { count: 'exact', head: true })
              .eq('group_id', g.id);
            
            return { 
              id: g.id,
              name: g.name,
              description: g.description || '',
              invite_code: g.invite_code || '',
              created_by: g.created_by || '',
              member_count: count || 0,
              status: (g.status as 'draft' | 'published') || 'published'
            };
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

  const searchGroups = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const { data: groups } = await supabase
        .from('groups')
        .select('id, name, description')
        .ilike('name', `%${searchQuery}%`)
        .eq('status', 'published')
        .limit(10);

      if (groups) {
        const groupsWithDetails = await Promise.all(groups.map(async (g) => {
          const { count } = await supabase
            .from('group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', g.id);

          // Get group's task templates
          const { data: templates } = await supabase
            .from('challenges')
            .select('name, weight')
            .eq('group_id', g.id);

          // If no custom templates, get defaults
          let tasks = templates || [];
          if (tasks.length === 0) {
            const { data: defaultTemplates } = await supabase
              .from('challenges')
              .select('name, weight')
              .eq('is_default', true);
            tasks = defaultTemplates || [];
          }

          return {
            ...g,
            member_count: count || 0,
            tasks: tasks.map(t => ({ name: t.name, weight: t.weight || 1 }))
          };
        }));

        setSearchResults(groupsWithDetails);
      }
    } catch (error) {
      console.error('Error searching groups:', error);
    } finally {
      setSearching(false);
    }
  };

  const checkGroupLimit = async (): Promise<boolean> => {
    const { count } = await supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user!.id);
    
    if (count && count >= 3) {
      toast({
        title: "Group limit reached",
        description: "You can only be a member of up to 3 groups",
        variant: "destructive"
      });
      return false;
    }
    return true;
  };

  const joinGroupById = async (groupId: string) => {
    setJoining(true);
    try {
      // Check if already a member
      const { data: existing } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', groupId)
        .eq('user_id', user!.id)
        .maybeSingle();

      if (existing) {
        toast({
          title: "Already a member",
          description: "You are already a member of this group",
          variant: "destructive"
        });
        return;
      }

      // Check 3-group limit
      if (!(await checkGroupLimit())) {
        return;
      }

      const { error } = await supabase
        .from('group_members')
        .insert({
          group_id: groupId,
          user_id: user!.id
        });

      if (error) throw error;

      toast({
        title: "Joined group!",
        description: "Welcome to the group"
      });

      setPreviewGroup(null);
      setSearchQuery('');
      setSearchResults([]);
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

  const fetchLeaderboard = async (groupId: string) => {
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
              const { data: tasks } = await supabase
                .from('daily_tasks')
                .select(`
                  completed,
                  challenges (weight)
                `)
                .eq('user_challenge_id', challenge.id)
                .eq('completed', true);

              if (tasks) {
                points = tasks.reduce((sum: number, t: any) => sum + (t.challenges?.weight || 0), 0);
              }
            }

            // Fetch cheers for this user in this group
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

  const createGroup = async () => {
    if (!newGroupName.trim()) return;
    setCreating(true);

    try {
      // Check for duplicate group name (case-insensitive)
      const { data: existingGroup } = await supabase
        .from('groups')
        .select('id')
        .ilike('name', newGroupName.trim())
        .maybeSingle();

      if (existingGroup) {
        toast({
          title: "Group name already exists",
          description: "Please choose a different name for your group.",
          variant: "destructive"
        });
        setCreating(false);
        return;
      }

      // Check 3-group limit before creating
      if (!(await checkGroupLimit())) {
        setCreating(false);
        return;
      }
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: newGroupName.trim(),
          description: newGroupDesc,
          created_by: user!.id,
          total_days: newGroupDays
        })
        .select()
        .single();

      if (groupError) {
        // Handle unique constraint violation
        if (groupError.code === '23505') {
          toast({
            title: "Group name already exists",
            description: "Please choose a different name for your group.",
            variant: "destructive"
          });
          return;
        }
        throw groupError;
      }

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
      setNewGroupDays(75);
      
      if (!useDefaultTasks) {
        setNewGroupId(group.id);
      }
      
      setUseDefaultTasks(true);
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
      // Check 3-group limit
      if (!(await checkGroupLimit())) {
        setJoining(false);
        return;
      }

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

      // Clear selected group if it was the one we left
      if (selectedGroup?.id === groupId) {
        setSelectedGroup(null);
        setLeaderboard([]);
      }
      
      // Update the groups list
      setMyGroups(prev => prev.filter(g => g.id !== groupId));
    } catch (error: any) {
      toast({
        title: "Error leaving group",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const removeMember = async (memberId: string, memberName: string) => {
    if (!selectedGroup) return;
    
    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', selectedGroup.id)
        .eq('user_id', memberId);

      if (error) throw error;

      toast({
        title: "Member removed",
        description: `${memberName} has been removed from the group`
      });

      fetchLeaderboard(selectedGroup.id);
      fetchGroups();
    } catch (error: any) {
      toast({
        title: "Error removing member",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const publishGroup = async (groupId: string) => {
    setPublishing(groupId);
    try {
      const { error } = await supabase
        .from('groups')
        .update({ status: 'published' })
        .eq('id', groupId);

      if (error) throw error;

      toast({
        title: "Group published!",
        description: "Members can now join and track their progress."
      });

      fetchGroups();
    } catch (error: any) {
      toast({
        title: "Error publishing group",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setPublishing(null);
    }
  };

  if (authLoading || loading) {
    return <SimpleLoadingSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader 
        title="Groups" 
        icon={<Users className="w-5 h-5 text-primary" />}
      >
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setJoinDialogOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Join
          </Button>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create
          </Button>
        </div>
      </AppHeader>

      {/* Join Group Dialog */}
      <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Join a Group</DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="code" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="code">Invite Code</TabsTrigger>
              <TabsTrigger value="search">Search Groups</TabsTrigger>
            </TabsList>
            
            <TabsContent value="code" className="space-y-4 pt-4">
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
            </TabsContent>
            
            <TabsContent value="search" className="space-y-4 pt-4">
              <div className="flex gap-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by group name..."
                  className="bg-secondary/50"
                  onKeyDown={(e) => e.key === 'Enter' && searchGroups()}
                />
                <Button onClick={searchGroups} disabled={searching}>
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
              
              <div className="max-h-60 overflow-y-auto space-y-2">
                {searchResults.length === 0 && searchQuery && !searching && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No groups found
                  </p>
                )}
                
                {searchResults.map((group) => (
                  <div
                    key={group.id}
                    className="p-3 rounded-lg bg-secondary/30 border border-border hover:border-primary/30 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{group.name}</h4>
                        <p className="text-xs text-muted-foreground">{group.member_count} members</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPreviewGroup(group)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Preview
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => joinGroupById(group.id)}
                          disabled={joining}
                        >
                          Join
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Create Group Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
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
            
            <div className="space-y-2">
              <Label>Challenge Duration</Label>
              <div className="grid grid-cols-4 gap-2">
                {[7, 30, 75, 90].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setNewGroupDays(days)}
                    className={`p-2 rounded-lg border text-center transition-all text-sm ${
                      newGroupDays === days
                        ? 'bg-primary/10 border-primary/30'
                        : 'bg-card border-border hover:border-primary/30'
                    }`}
                  >
                    <Clock className="w-4 h-4 mx-auto mb-1 text-primary" />
                    <span className="font-medium">{days}</span>
                    <p className="text-xs text-muted-foreground">days</p>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Challenge Tasks</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setUseDefaultTasks(true)}
                  className={`p-3 rounded-lg border text-left transition-all text-sm ${
                    useDefaultTasks
                      ? 'bg-primary/10 border-primary/30'
                      : 'bg-card border-border hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-4 h-4 text-primary" />
                    <span className="font-medium">Default 75 Hard</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Original challenge tasks</p>
                </button>
                
                <button
                  type="button"
                  onClick={() => setUseDefaultTasks(false)}
                  className={`p-3 rounded-lg border text-left transition-all text-sm ${
                    !useDefaultTasks
                      ? 'bg-primary/10 border-primary/30'
                      : 'bg-card border-border hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <ListChecks className="w-4 h-4 text-primary" />
                    <span className="font-medium">Custom Tasks</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Configure after creation</p>
                </button>
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground">
              Your group will be created as a draft. You can configure tasks and publish it when ready.
            </p>
            
            <Button onClick={createGroup} className="w-full" disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Group'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{group.name}</h3>
                    {group.status === 'draft' && (
                      <Badge variant="outline" className="text-xs">Draft</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{group.member_count} members</p>
                  
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {group.status === 'published' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyInviteCode(group.invite_code);
                        }}
                        title="Copy invite code to share with friends"
                      >
                        <UserPlus className="w-4 h-4 mr-1" />
                        Invite
                      </Button>
                    )}
                    {group.created_by === user!.id && group.status === 'draft' && (
                      <>
                        <div onClick={(e) => e.stopPropagation()}>
                          <TaskConfigDialog
                            groupId={group.id}
                            userId={user!.id}
                            isGroupCreator={true}
                            onSave={() => fetchLeaderboard(group.id)}
                            trigger={
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Settings2 className="w-4 h-4" />
                              </Button>
                            }
                          />
                        </div>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            publishGroup(group.id);
                          }}
                          disabled={publishing === group.id}
                        >
                          {publishing === group.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Send className="w-4 h-4 mr-1" />
                              Publish
                            </>
                          )}
                        </Button>
                      </>
                    )}
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
                    currentUserId={user?.id}
                    groupId={selectedGroup.id}
                    showCheers={true}
                    isGroupOwner={selectedGroup.created_by === user?.id}
                    onRemoveMember={removeMember}
                  />
                </motion.div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Group Preview Dialog */}
      <Dialog open={!!previewGroup} onOpenChange={() => setPreviewGroup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{previewGroup?.name}</DialogTitle>
          </DialogHeader>
          {previewGroup && (
            <div className="space-y-4 pt-2">
              {previewGroup.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="mt-1">{previewGroup.description}</p>
                </div>
              )}
              
              <div>
                <Label className="text-muted-foreground">Members</Label>
                <p className="mt-1 font-medium">{previewGroup.member_count} members</p>
              </div>
              
              <div>
                <Label className="text-muted-foreground">Challenge Tasks</Label>
                <div className="mt-2 space-y-2">
                  {previewGroup.tasks.map((task, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                      <span className="text-sm">{task.name}</span>
                      <span className="text-xs text-primary font-medium">{task.weight} pts</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <Button 
                className="w-full" 
                onClick={() => joinGroupById(previewGroup.id)}
                disabled={joining}
              >
                {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Join This Group'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Auto-open Task Config for newly created groups with custom tasks */}
      {newGroupId && (
        <TaskConfigDialog
          groupId={newGroupId}
          userId={user!.id}
          isGroupCreator={true}
          defaultOpen={true}
          onSave={() => {
            setNewGroupId(null);
            fetchGroups();
          }}
        />
      )}
    </div>
  );
}
