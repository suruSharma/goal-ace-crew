import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Loader2, User, Scale, Target, Calendar } from 'lucide-react';

interface ProfileData {
  full_name: string;
  birthdate: string;
  current_weight: number | null;
  goal_weight: number | null;
}

export default function Profile() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    full_name: '',
    birthdate: '',
    current_weight: null,
    goal_weight: null
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, birthdate, current_weight, goal_weight')
        .eq('id', user!.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setProfile({
          full_name: data.full_name || '',
          birthdate: data.birthdate || '',
          current_weight: data.current_weight,
          goal_weight: data.goal_weight
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name,
          birthdate: profile.birthdate || null,
          current_weight: profile.current_weight,
          goal_weight: profile.goal_weight
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
        <div className="container max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <h1 className="font-display font-bold text-xl">Profile Settings</h1>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl border border-border p-6"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center text-primary-foreground text-2xl font-bold">
              {profile.full_name?.charAt(0)?.toUpperCase() || 'U'}
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
              <Label htmlFor="birthdate" className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                Birthdate
              </Label>
              <Input
                id="birthdate"
                type="date"
                value={profile.birthdate}
                onChange={(e) => setProfile(p => ({ ...p, birthdate: e.target.value }))}
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
        </motion.div>
      </main>
    </div>
  );
}
