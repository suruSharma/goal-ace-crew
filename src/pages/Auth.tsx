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
import { Flame, Loader2, User, Lock, ArrowLeft } from 'lucide-react';

type AuthMode = 'signin' | 'signup' | 'forgot' | 'reset';

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState<AuthMode>('signin');
  const [loading, setLoading] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Check if user arrived via password reset link
  useEffect(() => {
    if (searchParams.get('reset') === 'true') {
      setMode('reset');
    }
  }, [searchParams]);

  useEffect(() => {
    if (user && !showProfileSetup && mode !== 'reset') {
      checkProfileComplete();
    }
  }, [user, showProfileSetup, mode]);

  const checkProfileComplete = async () => {
    if (!user) return;
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      await supabase
        .from('profiles')
        .insert({ 
          id: user.id, 
          email: user.email
        });
      setShowProfileSetup(true);
      return;
    }

    if (!profile.full_name) {
      setShowProfileSetup(true);
    } else {
      navigate('/dashboard');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === 'forgot') {
      await handleForgotPassword();
      return;
    }

    if (mode === 'reset') {
      await handleResetPassword();
      return;
    }

    if (!email || !password) {
      toast({
        title: "Error",
        description: "Please enter username and password",
        variant: "destructive"
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error } = await signUpWithEmail(email, password);
        if (error) {
          if (error.message.includes('already registered')) {
            toast({
              title: "Account exists",
              description: "This email is already registered. Please sign in instead.",
              variant: "destructive"
            });
          } else {
            toast({
              title: "Error",
              description: error.message,
              variant: "destructive"
            });
          }
        } else {
          toast({
            title: "Success",
            description: "Account created successfully!",
          });
        }
      } else {
        const { error } = await signInWithEmail(email, password);
        if (error) {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive"
          });
        }
      }
    } catch (err) {
      toast({
        title: "Error",
        description: (err as Error).message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast({
        title: "Error",
        description: "Please enter your username",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Apply the same username→email transformation used during sign-in
      const formattedEmail = email.includes('@') ? email : `${email}@75hard.app`;
      const response = await supabase.functions.invoke('send-password-reset', {
        body: { email: formattedEmail }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: "Check your email",
        description: "If an account exists with this email, you will receive a reset link.",
      });
      setMode('signin');
    } catch (err) {
      toast({
        title: "Error",
        description: (err as Error).message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!password || !confirmPassword) {
      toast({
        title: "Error",
        description: "Please enter and confirm your new password",
        variant: "destructive"
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive"
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      
      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: "Your password has been reset successfully!",
      });
      
      // Clear the reset param and redirect
      navigate('/dashboard');
    } catch (err) {
      toast({
        title: "Error",
        description: (err as Error).message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProfileComplete = () => {
    setShowProfileSetup(false);
    navigate('/dashboard');
  };

  const getTitle = () => {
    switch (mode) {
      case 'signup': return 'Create Account';
      case 'forgot': return 'Forgot Password';
      case 'reset': return 'Reset Password';
      default: return 'Welcome Back';
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--gradient-hero)' }}>
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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
            Transform your life, one day at a time
          </p>
        </div>

        <div className="glass rounded-2xl p-8">
          <h2 className="text-xl font-semibold text-center mb-6">
            {getTitle()}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode !== 'reset' && (
              <div className="space-y-2">
                <Label htmlFor="email">Username</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="text"
                    placeholder="Enter your username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            )}
            
            {(mode === 'signin' || mode === 'signup') && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            )}

            {mode === 'reset' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </>
            )}

            <Button 
              type="submit"
              className="w-full h-12 font-semibold"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : mode === 'signup' ? (
                'Sign Up'
              ) : mode === 'forgot' ? (
                'Send Reset Link'
              ) : mode === 'reset' ? (
                'Reset Password'
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          {(mode === 'signin' || mode === 'signup') && (
            <div className="mt-6 space-y-3">
              <div className="relative flex items-center gap-3">
                <div className="flex-1 border-t border-border" />
                <span className="text-xs text-muted-foreground">or continue with</span>
                <div className="flex-1 border-t border-border" />
              </div>

              <button
                type="button"
                onClick={signInWithGoogle}
                className="w-full flex items-center justify-center gap-3 h-11 rounded-lg border border-border bg-background hover:bg-muted transition-colors text-sm font-medium"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

            </div>
          )}

          <div className="mt-6 text-center space-y-2">
            {mode === 'signin' && (
              <>
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="text-sm text-muted-foreground hover:text-primary hover:underline block w-full"
                >
                  Forgot password?
                </button>
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="text-sm text-primary hover:underline block w-full"
                >
                  Don't have an account? Sign up
                </button>
              </>
            )}
            {mode === 'signup' && (
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="text-sm text-primary hover:underline"
              >
                Already have an account? Sign in
              </button>
            )}
            {(mode === 'forgot' || mode === 'reset') && (
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" />
                Back to sign in
              </button>
            )}
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </motion.div>

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
