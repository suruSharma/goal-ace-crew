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
import { Flame, ArrowRight, Loader2, ArrowLeft, Mail } from 'lucide-react';
import { z } from 'zod';

const authSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(2, 'Name must be at least 2 characters').optional(),
});

type AuthMode = 'login' | 'signup' | 'forgot-password' | 'check-email';

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

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
      if (mode === 'forgot-password') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        
        if (error) {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive"
          });
        } else {
          toast({
            title: "Check your email",
            description: "We've sent you a password reset link.",
          });
          setMode('login');
        }
        setLoading(false);
        return;
      }

      const validationData = mode === 'login' 
        ? { email, password }
        : { email, password, fullName };
      
      authSchema.parse(validationData);

      const { error, data } = mode === 'login' 
        ? await signIn(email, password)
        : await signUp(email, password, fullName);

      if (error) {
        let errorMessage = error.message;
        
        if (error.message.includes('User already registered') || 
            error.message.includes('already been registered')) {
          errorMessage = 'An account with this email already exists. Please sign in instead.';
        } else if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Invalid email or password. Please try again.';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = 'Please check your email and confirm your account before signing in.';
          setMode('check-email');
        }
        
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive"
        });
      } else if (mode === 'signup') {
        if (data?.user && !data?.session) {
          setMode('check-email');
          toast({
            title: "Check your email!",
            description: "We've sent you a confirmation link. Please verify your email to continue.",
          });
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

  const handleResendConfirmation = async () => {
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address.",
        variant: "destructive"
      });
      return;
    }

    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        }
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Email sent!",
          description: "We've resent the confirmation link to your email.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setResending(false);
    }
  };

  const handleProfileComplete = () => {
    setShowProfileSetup(false);
    navigate('/dashboard');
  };

  const renderForm = () => {
    if (mode === 'check-email') {
      return (
        <div className="text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-2">Check your email</h2>
            <p className="text-muted-foreground text-sm">
              We've sent a confirmation link to <strong>{email}</strong>
            </p>
          </div>
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleResendConfirmation}
              disabled={resending}
            >
              {resending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Mail className="w-4 h-4 mr-2" />
              )}
              Resend confirmation email
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setMode('login');
                setEmail('');
                setPassword('');
              }}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to sign in
            </Button>
          </div>
        </div>
      );
    }

    if (mode === 'forgot-password') {
      return (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-center mb-4">
            <h2 className="text-xl font-semibold">Reset your password</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Enter your email and we'll send you a reset link
            </p>
          </div>
          
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

          <Button 
            type="submit" 
            className="w-full h-12 font-semibold"
            disabled={loading}
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

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'signup' && (
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
            {mode === 'check-email' && 'Almost there!'}
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
          onComplete={handleProfileComplete}
        />
      )}
    </div>
  );
}
