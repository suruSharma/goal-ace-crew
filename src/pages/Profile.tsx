import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ArrowLeft, Save, Loader2, User, Scale, Target, CalendarIcon, Trash2, Ruler, Plus, Camera, Users, AlertTriangle, Heart, Mail } from 'lucide-react';
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
  const [ownedGroupsSummary, setOwnedGroupsSummary] = useState<{
    groupName: string;
    newOwnerName: string | null;
    willBeDeleted: boolean;
  }[]>([]);
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
  const [addingWeight, setAddingWeight] = useState(false);
  const [weightDialogOpen, setWeightDialogOpen] = useState(false);

  const calculatedBMI = useMemo(() => {
    if (!profile.height_cm || !profile.current_weight) return null;
    const bmi = profile.current_weight / Math.pow(profile.height_cm / 100, 2);
    return Math.round(bmi * 10) / 10;
  }, [profile.height_cm, profile.current_weight]);

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
    }
  }, [user]);

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
      
      // Add to weight history
      const { error: historyError } = await supabase
        .from('weight_history')
        .insert({
          user_id: user!.id,
          weight_kg: weightKg
        });

      if (historyError) throw historyError;

      // Update current weight in profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ current_weight: weightKg })
        .eq('id', user!.id);

      if (profileError) throw profileError;

      setProfile(p => ({ ...p, current_weight: weightKg }));
      setNewWeight('');
      setWeightDialogOpen(false);
      await fetchWeightHistory();

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
      const { data: ownedGroups } = await supabase
        .from('groups')
        .select('id, name')
        .eq('created_by', user!.id);

      if (!ownedGroups || ownedGroups.length === 0) {
        setOwnedGroupsSummary([]);
        return;
      }

      const summary = await Promise.all(
        ownedGroups.map(async (group) => {
          const { data: members } = await supabase
            .from('group_members')
            .select(`
              user_id,
              profiles (full_name)
            `)
            .eq('group_id', group.id)
            .neq('user_id', user!.id);

          if (!members || members.length === 0) {
            return {
              groupName: group.name,
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
            newOwnerName: memberPoints[0].name,
            willBeDeleted: false
          };
        })
      );

      setOwnedGroupsSummary(summary);
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

      // Delete profile
      await supabase
        .from('profiles')
        .delete()
        .eq('id', user!.id);

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
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <h1 className="font-display font-bold text-xl">Profile Settings</h1>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-8 space-y-6">
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

            {calculatedBMI && (
              <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                <Label className="text-xs text-muted-foreground">Current BMI</Label>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-primary">{calculatedBMI}</span>
                  <span className="text-sm text-muted-foreground">({getBMICategory(calculatedBMI)})</span>
                </div>
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
                    <Label>Weight (kg)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={newWeight}
                      onChange={(e) => setNewWeight(e.target.value)}
                      placeholder="Enter your current weight"
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

        {/* Danger Zone */}
        <div
          className="bg-card rounded-2xl border border-destructive/30 p-6 animate-fade-in"
          style={{ animationDelay: '0.2s' }}
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
                      This action cannot be undone. This will permanently delete your profile, all your challenges, tasks, and remove you from all groups.
                    </p>
                    
                    {loadingDeleteSummary ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Checking owned groups...</span>
                      </div>
                    ) : ownedGroupsSummary.length > 0 && (
                      <div className="rounded-lg bg-muted/50 border border-border p-3 space-y-2">
                        <p className="font-medium text-foreground flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          Groups you own:
                        </p>
                        <ul className="space-y-2 text-sm">
                          {ownedGroupsSummary.map((group, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-muted-foreground">•</span>
                              <span>
                                <span className="font-medium text-foreground">{group.groupName}</span>
                                {group.willBeDeleted ? (
                                  <span className="text-destructive"> — will be deleted (no other members)</span>
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
    </div>
  );
}
