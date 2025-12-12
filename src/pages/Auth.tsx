import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProfileSetupDialog } from '@/components/ProfileSetupDialog';
import { useToast } from '@/hooks/use-toast';
import { Flame, ArrowRight, Loader2, ArrowLeft, Key } from 'lucide-react';
import { z } from 'zod';

const authSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(20, 'Username must be less than 20 characters').regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type AuthMode = 'login' | 'signup' | 'forgot-password' | 'reset-password';

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Convert username to fake email for Supabase Auth
  const usernameToEmail = (uname: string) => `${uname.toLowerCase()}@75hard.app`;

  // Check if user came from password reset link
  useEffect(() => {
    if (searchParams.get('reset') === 'true') {
      setMode('reset-password');
    }
  }, [searchParams]);

  useEffect(() => {
    if (user && !showProfileSetup) {
      checkProfileComplete();
    }
  }, [user, showProfileSetup]);

  const checkProfileComplete = async () => {
    if (!user) return;
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();

    // If no profile exists, create one
    if (!profile) {
      await supabase
        .from('profiles')
        .insert({ id: user.id, email: user.email });
      setShowProfileSetup(true);
      return;
    }

    // Show profile setup if name is not set
    if (!profile.full_name) {
      setShowProfileSetup(true);
    } else {
      navigate('/dashboard');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Handle forgot password
      if (mode === 'forgot-password') {
        const { error } = await supabase.functions.invoke('send-password-reset', {
          body: { username }
        });

        if (error) throw error;

        toast({
          title: "Check your email",
          description: "If you have a recovery email set, you'll receive a reset link.",
        });
        setMode('login');
        setLoading(false);
        return;
      }

      // Handle password reset
      if (mode === 'reset-password') {
        const { error } = await supabase.auth.updateUser({ password: newPassword });

        if (error) throw error;

        toast({
          title: "Password updated!",
          description: "You can now sign in with your new password.",
        });
        setMode('login');
        setNewPassword('');
        setLoading(false);
        return;
      }

      const validationData = { username, password };
      authSchema.parse(validationData);

      const email = usernameToEmail(username);
      const { error, data } = mode === 'login' 
        ? await signIn(email, password)
        : await signUp(email, password);

      if (error) {
        let errorMessage = error.message;
        
        if (error.message.includes('User already registered') || 
            error.message.includes('already been registered')) {
          errorMessage = 'This username is already taken. Please choose another or sign in.';
        } else if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Invalid username or password. Please try again.';
        }
        
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive"
        });
      } else if (mode === 'signup') {
        toast({
          title: "Account created!",
          description: "Welcome to 75 Hard. Let's set up your profile!"
        });
        setShowProfileSetup(true);
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: err.issues[0].message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Error",
          description: (err as Error).message,
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

  const renderForm = () => {
    // Forgot password form
    if (mode === 'forgot-password') {
      return (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-center mb-4">
            <h2 className="text-xl font-semibold">Reset your password</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Enter your username and we'll send a reset link to your recovery email
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your_username"
              className="bg-secondary/50"
            />
          </div>

          <Button 
            type="submit" 
            className="w-full h-12 font-semibold"
            disabled={loading || !username}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Send reset link
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => setMode('login')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to sign in
          </Button>
        </form>
      );
    }

    // Reset password form (after clicking email link)
    if (mode === 'reset-password') {
      return (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-center mb-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Key className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Set new password</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Enter your new password below
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-secondary/50"
              autoComplete="new-password"
            />
          </div>

          <Button 
            type="submit" 
            className="w-full h-12 font-semibold"
            disabled={loading || newPassword.length < 6}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Update Password
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
        </form>
      );
    }

    // Login / Signup form
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="your_username"
            className="bg-secondary/50"
            autoComplete="username"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            {mode === 'login' && (
              <button
                type="button"
                onClick={() => setMode('forgot-password')}
                className="text-xs text-primary hover:underline"
              >
                Forgot password?
              </button>
            )}
          </div>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="bg-secondary/50"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
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
              {mode === 'login' ? 'Sign In' : 'Create Account'}
              <ArrowRight className="w-5 h-5 ml-2" />
            </>
          )}
        </Button>
      </form>
    );
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
            {mode === 'login' && 'Welcome back, warrior!'}
            {mode === 'signup' && 'Start your transformation'}
            {mode === 'forgot-password' && 'Reset your password'}
            {mode === 'reset-password' && 'Create a new password'}
          </p>
        </div>

        <div className="glass rounded-2xl p-8">
          {renderForm()}

          {(mode === 'login' || mode === 'signup') && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
            </div>
          )}
        </div>
      </motion.div>

      {user && (
        <ProfileSetupDialog
          open={showProfileSetup}
          onOpenChange={setShowProfileSetup}
          userId={user.id}
          username={username}
          onComplete={handleProfileComplete}
        />
      )}
    </div>
  );
}
