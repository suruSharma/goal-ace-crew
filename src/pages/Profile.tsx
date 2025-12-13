import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { postWeightLog } from '@/lib/feedUtils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ArrowLeft, Save, Loader2, User, Scale, Target, CalendarIcon, Trash2, Ruler, Plus, Camera, Users, AlertTriangle, Heart, Mail, Palette, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { ThemeSettings } from '@/components/ThemeSettings';
import { WeightProgressChart } from '@/components/WeightProgressChart';
import { FavoriteQuotes } from '@/components/FavoriteQuotes';
import { SimpleLoadingSkeleton } from '@/components/PageLoadingSkeleton';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ProfileData {
  full_name: string;
  birthdate: string;
  current_weight: number | null;
  goal_weight: number | null;
  height_cm: number | null;
  avatar_url: string | null;
  recovery_email: string;
}

interface WeightEntry {
  id: string;
  weight_kg: number;
  recorded_at: string;
}

export default function Profile() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loadingDeleteSummary, setLoadingDeleteSummary] = useState(false);
  const [deleteSummary, setDeleteSummary] = useState<{
    challenges: number;
    dailyTasks: number;
    achievements: number;
    favoriteQuotes: number;
    weightEntries: number;
    cheers: number;
    groupComments: number;
    groupMemberships: number;
    ownedGroups: {
      groupName: string;
      status: string;
      newOwnerName: string | null;
      willBeDeleted: boolean;
    }[];
  } | null>(null);
  const [profile, setProfile] = useState<ProfileData>({
    full_name: '',
    birthdate: '',
    current_weight: null,
    goal_weight: null,
    height_cm: null,
    avatar_url: null,
    recovery_email: ''
  });
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>([]);
  const [newWeight, setNewWeight] = useState('');
  const [weightDate, setWeightDate] = useState<Date>(new Date());
  const [addingWeight, setAddingWeight] = useState(false);
  const [weightDialogOpen, setWeightDialogOpen] = useState(false);
  const [myGroups, setMyGroups] = useState<{ id: string; name: string; status: string; memberCount: number }[]>([]);

  // Calculate BMI in real-time from current input values (not saved values)
  const calculatedBMI = useMemo(() => {
    const height = profile.height_cm;
    const weight = profile.current_weight;
    if (!height || !weight) return null;
    const bmi = weight / Math.pow(height / 100, 2);
    return Math.round(bmi * 10) / 10;
  }, [profile.height_cm, profile.current_weight]);

  const goalBMI = useMemo(() => {
    const height = profile.height_cm;
    const goalWeight = profile.goal_weight;
    if (!height || !goalWeight) return null;
    const bmi = goalWeight / Math.pow(height / 100, 2);
    return Math.round(bmi * 10) / 10;
  }, [profile.height_cm, profile.goal_weight]);

  const getBMICategory = (bmi: number): string => {
    if (bmi < 18.5) return 'Underweight';
    if (bmi < 25) return 'Normal';
    if (bmi < 30) return 'Overweight';
    return 'Obese';
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchWeightHistory();
      fetchMyGroups();
    }
  }, [user]);

  const fetchMyGroups = async () => {
    try {
      const { data: groups, error } = await supabase
        .from('groups')
        .select('id, name, status')
        .eq('created_by', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get member counts for each group
      const groupsWithCounts = await Promise.all(
        (groups || []).map(async (group) => {
          const { count } = await supabase
            .from('group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id);
          
          return {
            ...group,
            memberCount: count || 0
          };
        })
      );

      setMyGroups(groupsWithCounts);
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, birthdate, current_weight, goal_weight, height_cm, avatar_url, recovery_email')
        .eq('id', user!.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setProfile({
          full_name: data.full_name || '',
          birthdate: data.birthdate || '',
          current_weight: data.current_weight,
          goal_weight: data.goal_weight,
          height_cm: data.height_cm,
          avatar_url: data.avatar_url,
          recovery_email: data.recovery_email || ''
        });
      }
    } catch (error: any) {
      toast({
        title: "Error loading profile",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please select an image file",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image under 5MB",
        variant: "destructive"
      });
      return;
    }

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile with avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setProfile(p => ({ ...p, avatar_url: publicUrl }));

      toast({
        title: "Avatar updated!",
        description: "Your profile picture has been updated."
      });
    } catch (error: any) {
      toast({
        title: "Error uploading avatar",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const fetchWeightHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('weight_history')
        .select('id, weight_kg, recorded_at')
        .eq('user_id', user!.id)
        .order('recorded_at', { ascending: true });

      if (error) throw error;
      setWeightHistory(data || []);
    } catch (error: any) {
      console.error('Error fetching weight history:', error);
    }
  };

  const handleAddWeight = async () => {
    if (!newWeight) return;
    
    setAddingWeight(true);
    try {
      const weightKg = parseFloat(newWeight);
      const recordedAt = weightDate.toISOString();
      
      // Add to weight history with the selected date
      const { error: historyError } = await supabase
        .from('weight_history')
        .insert({
          user_id: user!.id,
          weight_kg: weightKg,
          recorded_at: recordedAt
        });

      if (historyError) throw historyError;

      // Only update current weight if the date is today
      const isToday = weightDate.toDateString() === new Date().toDateString();
      if (isToday) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ current_weight: weightKg })
          .eq('id', user!.id);

        if (profileError) throw profileError;
        setProfile(p => ({ ...p, current_weight: weightKg }));
      }

      setNewWeight('');
      setWeightDate(new Date());
      setWeightDialogOpen(false);
      await fetchWeightHistory();

      // Auto-post to feed
      postWeightLog(user!.id, weightKg);

      toast({
        title: "Weight updated!",
        description: "Your progress has been recorded."
      });
    } catch (error: any) {
      toast({
        title: "Error adding weight",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setAddingWeight(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name,
          birthdate: profile.birthdate || null,
          current_weight: profile.current_weight,
          goal_weight: profile.goal_weight,
          height_cm: profile.height_cm,
          recovery_email: profile.recovery_email || null
        })
        .eq('id', user!.id);

      if (error) throw error;

      toast({
        title: "Profile updated!",
        description: "Your changes have been saved."
      });
    } catch (error: any) {
      toast({
        title: "Error saving profile",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const fetchDeleteSummary = async () => {
    setLoadingDeleteSummary(true);
    try {
      // Fetch all counts in parallel
      const [
        challengesResult,
        achievementsResult,
        favoriteQuotesResult,
        weightHistoryResult,
        cheersResult,
        groupCommentsResult,
        groupMembershipsResult,
        ownedGroupsResult
      ] = await Promise.all([
        supabase.from('user_challenges').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
        supabase.from('user_achievements').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
        supabase.from('favorite_quotes').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
        supabase.from('weight_history').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
        supabase.from('cheers').select('id', { count: 'exact', head: true }).or(`from_user_id.eq.${user!.id},to_user_id.eq.${user!.id}`),
        supabase.from('group_comments').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
        supabase.from('group_members').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
        supabase.from('groups').select('id, name, status').eq('created_by', user!.id)
      ]);

      // Get daily tasks count
      const { data: userChallenges } = await supabase
        .from('user_challenges')
        .select('id')
        .eq('user_id', user!.id);
      
      let dailyTasksCount = 0;
      if (userChallenges && userChallenges.length > 0) {
        const challengeIds = userChallenges.map(c => c.id);
        const { count } = await supabase
          .from('daily_tasks')
          .select('id', { count: 'exact', head: true })
          .in('user_challenge_id', challengeIds);
        dailyTasksCount = count || 0;
      }

      // Process owned groups
      const ownedGroups = ownedGroupsResult.data || [];
      const ownedGroupsSummary = await Promise.all(
        ownedGroups.map(async (group) => {
          const { data: members } = await supabase
            .from('group_members')
            .select(`user_id, profiles (full_name)`)
            .eq('group_id', group.id)
            .neq('user_id', user!.id);

          if (!members || members.length === 0) {
            return {
              groupName: group.name,
              status: group.status,
              newOwnerName: null,
              willBeDeleted: true
            };
          }

          // Calculate points for each member
          const memberPoints = await Promise.all(
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
                  .select(`completed, challenges (weight)`)
                  .eq('user_challenge_id', challenge.id)
                  .eq('completed', true);

                if (tasks) {
                  points = tasks.reduce((sum: number, t: any) => 
                    sum + (t.challenges?.weight || 0), 0
                  );
                }
              }
              return { 
                userId: m.user_id, 
                name: m.profiles?.full_name || 'Unknown',
                points 
              };
            })
          );

          memberPoints.sort((a, b) => b.points - a.points);
          
          return {
            groupName: group.name,
            status: group.status,
            newOwnerName: memberPoints[0].name,
            willBeDeleted: false
          };
        })
      );

      setDeleteSummary({
        challenges: challengesResult.count || 0,
        dailyTasks: dailyTasksCount,
        achievements: achievementsResult.count || 0,
        favoriteQuotes: favoriteQuotesResult.count || 0,
        weightEntries: weightHistoryResult.count || 0,
        cheers: cheersResult.count || 0,
        groupComments: groupCommentsResult.count || 0,
        groupMemberships: groupMembershipsResult.count || 0,
        ownedGroups: ownedGroupsSummary
      });
    } catch (error) {
      console.error('Error fetching delete summary:', error);
    } finally {
      setLoadingDeleteSummary(false);
    }
  };

  const handleOpenDeleteDialog = () => {
    setDeleteDialogOpen(true);
    fetchDeleteSummary();
  };

  const handleDeleteProfile = async () => {
    setDeleting(true);
    try {
      // Transfer ownership of groups before deletion
      const { data: ownedGroups } = await supabase
        .from('groups')
        .select('id')
        .eq('created_by', user!.id);

      if (ownedGroups && ownedGroups.length > 0) {
        for (const group of ownedGroups) {
          // Get all other members of this group
          const { data: members } = await supabase
            .from('group_members')
            .select('user_id')
            .eq('group_id', group.id)
            .neq('user_id', user!.id);

          if (members && members.length > 0) {
            // Calculate points for each member to find top of leaderboard
            const memberPoints = await Promise.all(
              members.map(async (m) => {
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
                    points = tasks.reduce((sum: number, t: any) => 
                      sum + (t.challenges?.weight || 0), 0
                    );
                  }
                }
                return { userId: m.user_id, points };
              })
            );

            // Sort by points descending and get top member
            memberPoints.sort((a, b) => b.points - a.points);
            const newOwner = memberPoints[0].userId;

            // Transfer ownership
            await supabase
              .from('groups')
              .update({ created_by: newOwner })
              .eq('id', group.id);
          } else {
            // No other members - delete the group
            await supabase
              .from('groups')
              .delete()
              .eq('id', group.id);
          }
        }
      }

      // Delete user's challenges and tasks
      const { data: challenges } = await supabase
        .from('user_challenges')
        .select('id')
        .eq('user_id', user!.id);

      if (challenges && challenges.length > 0) {
        const challengeIds = challenges.map(c => c.id);
        await supabase
          .from('daily_tasks')
          .delete()
          .in('user_challenge_id', challengeIds);
        
        await supabase
          .from('user_challenges')
          .delete()
          .eq('user_id', user!.id);
      }

      // Delete group memberships
      await supabase
        .from('group_members')
        .delete()
        .eq('user_id', user!.id);

      // Delete cheers (both sent and received)
      await supabase
        .from('cheers')
        .delete()
        .eq('from_user_id', user!.id);
      
      await supabase
        .from('cheers')
        .delete()
        .eq('to_user_id', user!.id);

      // Delete favorite quotes
      await supabase
        .from('favorite_quotes')
        .delete()
        .eq('user_id', user!.id);

      // Delete user's custom challenges
      await supabase
        .from('challenges')
        .delete()
        .eq('created_by', user!.id)
        .eq('is_default', false);

      // Delete weight history
      await supabase
        .from('weight_history')
        .delete()
        .eq('user_id', user!.id);

      // Delete avatar from storage
      if (profile.avatar_url) {
        const avatarPath = `${user!.id}/`;
        await supabase.storage
          .from('avatars')
          .remove([avatarPath]);
      }

      // Delete the user completely (including auth.users) via edge function
      const { data: session } = await supabase.auth.getSession();
      if (session?.session?.access_token) {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.session.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to delete user');
        }
      }

      toast({
        title: "Profile deleted",
        description: "Your profile and all associated data have been deleted."
      });

      await signOut();
      navigate('/auth');
    } catch (error: any) {
      toast({
        title: "Error deleting profile",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setDeleting(false);
    }
  };

  if (authLoading || loading) {
    return <SimpleLoadingSkeleton />;
  }

  return (
    <>
      <main className="container max-w-2xl mx-auto px-4 py-8 space-y-6">
        <PageHeader 
          title="Profile Settings" 
          icon={<User className="w-5 h-5 text-primary" />}
        />
        <div
          className="bg-card rounded-2xl border border-border p-6 animate-fade-in"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="relative group">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center text-primary-foreground text-2xl font-bold overflow-hidden">
                {profile.avatar_url ? (
                  <img 
                    src={profile.avatar_url} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  profile.full_name?.charAt(0)?.toUpperCase() || 'U'
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
              >
                {uploadingAvatar ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : (
                  <Camera className="w-6 h-6 text-white" />
                )}
              </button>
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold">{profile.full_name || 'Your Profile'}</h2>
              <p className="text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                Full Name
              </Label>
              <Input
                id="fullName"
                value={profile.full_name}
                onChange={(e) => setProfile(p => ({ ...p, full_name: e.target.value }))}
                placeholder="Your name"
                className="bg-secondary/50"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                Birthdate
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-secondary/50",
                      !profile.birthdate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {profile.birthdate ? format(parseISO(profile.birthdate), "PPP") : "Pick your birth date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={profile.birthdate ? parseISO(profile.birthdate) : undefined}
                    onSelect={(date) => setProfile(p => ({ 
                      ...p, 
                      birthdate: date ? format(date, 'yyyy-MM-dd') : '' 
                    }))}
                    disabled={(date) => date > new Date()}
                    captionLayout="dropdown"
                    startMonth={new Date(1940, 0)}
                    endMonth={new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="height" className="flex items-center gap-2">
                <Ruler className="w-4 h-4 text-muted-foreground" />
                Height (cm)
              </Label>
              <Input
                id="height"
                type="number"
                step="0.1"
                value={profile.height_cm || ''}
                onChange={(e) => setProfile(p => ({ 
                  ...p, 
                  height_cm: e.target.value ? parseFloat(e.target.value) : null 
                }))}
                placeholder="175"
                className="bg-secondary/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currentWeight" className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-muted-foreground" />
                  Current Weight (kg)
                </Label>
                <Input
                  id="currentWeight"
                  type="number"
                  step="0.1"
                  value={profile.current_weight || ''}
                  onChange={(e) => setProfile(p => ({ 
                    ...p, 
                    current_weight: e.target.value ? parseFloat(e.target.value) : null 
                  }))}
                  placeholder="75.0"
                  className="bg-secondary/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="goalWeight" className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-muted-foreground" />
                  Goal Weight (kg)
                </Label>
                <Input
                  id="goalWeight"
                  type="number"
                  step="0.1"
                  value={profile.goal_weight || ''}
                  onChange={(e) => setProfile(p => ({ 
                    ...p, 
                    goal_weight: e.target.value ? parseFloat(e.target.value) : null 
                  }))}
                  placeholder="70.0"
                  className="bg-secondary/50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="recoveryEmail" className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                Recovery Email (optional)
              </Label>
              <Input
                id="recoveryEmail"
                type="email"
                value={profile.recovery_email}
                onChange={(e) => setProfile(p => ({ ...p, recovery_email: e.target.value }))}
                placeholder="your@email.com"
                className="bg-secondary/50"
              />
              <p className="text-xs text-muted-foreground">
                Add an email to recover your password if you forget it
              </p>
            </div>

            {(calculatedBMI || goalBMI) && (
              <div className="grid grid-cols-2 gap-4">
                {calculatedBMI && (
                  <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                    <Label className="text-xs text-muted-foreground">Current BMI</Label>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-primary">{calculatedBMI}</span>
                      <span className="text-sm text-muted-foreground">({getBMICategory(calculatedBMI)})</span>
                    </div>
                  </div>
                )}
                {goalBMI && (
                  <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                    <Label className="text-xs text-muted-foreground">Goal BMI</Label>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-accent">{goalBMI}</span>
                      <span className="text-sm text-muted-foreground">({getBMICategory(goalBMI)})</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <Button 
              onClick={handleSave} 
              className="w-full h-12"
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Weight Progress Section */}
        <div
          className="bg-card rounded-2xl border border-border p-6 animate-fade-in"
          style={{ animationDelay: '0.1s' }}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display font-bold text-lg">Weight Progress</h3>
            <Dialog open={weightDialogOpen} onOpenChange={setWeightDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Log Weight
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Log Your Weight</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal bg-secondary/50",
                            !weightDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {weightDate ? format(weightDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={weightDate}
                          onSelect={(date) => date && setWeightDate(date)}
                          disabled={(date) => date > new Date()}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>Weight (kg)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={newWeight}
                      onChange={(e) => setNewWeight(e.target.value)}
                      placeholder="Enter your weight"
                      className="bg-secondary/50"
                    />
                  </div>
                  <Button 
                    onClick={handleAddWeight} 
                    className="w-full"
                    disabled={addingWeight || !newWeight}
                  >
                    {addingWeight ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Save Weight"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <WeightProgressChart 
            data={weightHistory} 
            heightCm={profile.height_cm}
            goalWeight={profile.goal_weight}
          />
        </div>

        {/* Favorite Quotes Section */}
        <div
          className="bg-card rounded-2xl border border-border p-6 animate-fade-in"
          style={{ animationDelay: '0.15s' }}
        >
          <h3 className="font-display font-bold text-lg flex items-center gap-2 mb-4">
            <Heart className="w-5 h-5 text-red-500" />
            Favorite Quotes
          </h3>
          <FavoriteQuotes userId={user!.id} />
        </div>

        {/* My Groups Section */}
        <div
          className="bg-card rounded-2xl border border-border p-6 animate-fade-in"
          style={{ animationDelay: '0.2s' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              My Groups
            </h3>
            <Link to="/groups">
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Create Group
              </Button>
            </Link>
          </div>
          
          {myGroups.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">
              You haven't created any groups yet
            </p>
          ) : (
            <div className="space-y-2">
              {myGroups.map((group) => (
                <Link
                  key={group.id}
                  to={`/groups/${group.id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors group"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{group.name}</span>
                      {group.status === 'draft' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          Draft
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
                    </span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Theme Settings Section */}
        <div
          className="bg-card rounded-2xl border border-border p-6 animate-fade-in"
          style={{ animationDelay: '0.25s' }}
        >
          <h3 className="font-display font-bold text-lg flex items-center gap-2 mb-4">
            <Palette className="w-5 h-5 text-primary" />
            Appearance
          </h3>
          <ThemeSettings />
        </div>

        {/* Danger Zone */}
        <div
          className="bg-card rounded-2xl border border-destructive/30 p-6 animate-fade-in"
          style={{ animationDelay: '0.3s' }}
        >
          <h3 className="font-display font-bold text-lg text-destructive mb-2">Danger Zone</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Once you delete your profile, there is no going back. All your data including challenges, tasks, and group memberships will be permanently deleted.
          </p>
          
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                className="w-full" 
                disabled={deleting}
                onClick={handleOpenDeleteDialog}
              >
                {deleting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-5 h-5 mr-2" />
                    Delete Profile
                  </>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-lg">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  Are you absolutely sure?
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-4">
                    <p>
                      This action cannot be undone. This will permanently delete your profile and all associated data.
                    </p>
                    
                    {loadingDeleteSummary ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Loading deletion summary...</span>
                      </div>
                    ) : deleteSummary && (
                      <div className="space-y-3">
                        {/* Data counts */}
                        <div className="rounded-lg bg-muted/50 border border-border p-3">
                          <p className="font-medium text-foreground mb-2">Data to be deleted:</p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Challenges:</span>
                              <span className="font-medium text-foreground">{deleteSummary.challenges}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Daily Tasks:</span>
                              <span className="font-medium text-foreground">{deleteSummary.dailyTasks}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Achievements:</span>
                              <span className="font-medium text-foreground">{deleteSummary.achievements}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Weight Entries:</span>
                              <span className="font-medium text-foreground">{deleteSummary.weightEntries}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Favorite Quotes:</span>
                              <span className="font-medium text-foreground">{deleteSummary.favoriteQuotes}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Group Comments:</span>
                              <span className="font-medium text-foreground">{deleteSummary.groupComments}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Cheers:</span>
                              <span className="font-medium text-foreground">{deleteSummary.cheers}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Group Memberships:</span>
                              <span className="font-medium text-foreground">{deleteSummary.groupMemberships}</span>
                            </div>
                          </div>
                        </div>

                        {/* Owned groups section */}
                        {deleteSummary.ownedGroups.length > 0 && (
                          <div className="rounded-lg bg-muted/50 border border-border p-3 space-y-2">
                            <p className="font-medium text-foreground flex items-center gap-2">
                              <Users className="w-4 h-4" />
                              Groups you own ({deleteSummary.ownedGroups.length}):
                            </p>
                            <ul className="space-y-2 text-sm">
                              {deleteSummary.ownedGroups.map((group, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <span className="text-muted-foreground">•</span>
                                  <span>
                                    <span className="font-medium text-foreground">{group.groupName}</span>
                                    {group.status === 'draft' && (
                                      <span className="text-muted-foreground text-xs ml-1">(draft)</span>
                                    )}
                                    {group.willBeDeleted ? (
                                      <span className="text-destructive"> — will be deleted</span>
                                    ) : (
                                      <span className="text-muted-foreground"> — ownership transfers to <span className="text-primary font-medium">{group.newOwnerName}</span></span>
                                    )}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteProfile}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={loadingDeleteSummary}
                >
                  Delete Profile
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </main>
    </>
  );
}
