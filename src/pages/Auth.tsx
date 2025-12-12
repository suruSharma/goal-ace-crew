import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProfileSetupDialog } from '@/components/ProfileSetupDialog';
import { useToast } from '@/hooks/use-toast';
import { Flame, ArrowRight, Loader2 } from 'lucide-react';
import { z } from 'zod';

const authSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(2, 'Name must be at least 2 characters').optional(),
});

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !showProfileSetup) {
      // Check if profile is complete
      checkProfileComplete();
    }
  }, [user, showProfileSetup]);

  const checkProfileComplete = async () => {
    if (!user) return;
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('birthdate, current_weight, goal_weight, goal_date')
      .eq('id', user.id)
      .maybeSingle();

    // If any required field is missing, show setup dialog
    if (profile && (!profile.birthdate || !profile.current_weight || !profile.goal_weight || !profile.goal_date)) {
      setShowProfileSetup(true);
    } else {
      navigate('/dashboard');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validationData = isLogin 
        ? { email, password }
        : { email, password, fullName };
      
      authSchema.parse(validationData);

      const { error, data } = isLogin 
        ? await signIn(email, password)
        : await signUp(email, password, fullName);

      if (error) {
        // Handle specific error cases
        let errorMessage = error.message;
        
        if (error.message.includes('User already registered') || 
            error.message.includes('already been registered')) {
          errorMessage = 'An account with this email already exists. Please sign in instead.';
        } else if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Invalid email or password. Please try again.';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = 'Please check your email and confirm your account before signing in.';
        }
        
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive"
        });
      } else if (!isLogin) {
        // Check if email confirmation is required
        if (data?.user && !data?.session) {
          toast({
            title: "Check your email!",
            description: "We've sent you a confirmation link. Please verify your email to continue.",
          });
          // Reset form
          setEmail('');
          setPassword('');
          setFullName('');
          setIsLogin(true);
        } else {
          toast({
            title: "Account created!",
            description: "Welcome to 75 Hard. Let's set up your profile!"
          });
          setShowProfileSetup(true);
        }
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: err.issues[0].message,
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleProfileComplete = () => {
    setShowProfileSetup(false);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--gradient-hero)' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 mb-4">
            <Flame className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-display font-bold">75 Hard</h1>
          <p className="text-muted-foreground mt-2">
            {isLogin ? 'Welcome back, warrior!' : 'Start your transformation'}
          </p>
        </div>

        <div className="glass rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                  className="bg-secondary/50"
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="bg-secondary/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-secondary/50"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full mt-6 h-12 font-semibold"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isLogin ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Profile Setup Dialog */}
      {user && (
        <ProfileSetupDialog
          open={showProfileSetup}
          onOpenChange={setShowProfileSetup}
          userId={user.id}
          onComplete={handleProfileComplete}
        />
      )}
    </div>
  );
}
