import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Flame, ArrowRight, Target, Users, Trophy } from 'lucide-react';
import { SimpleLoadingSkeleton } from '@/components/PageLoadingSkeleton';

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return <SimpleLoadingSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Hero Section */}
      <div className="relative min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--gradient-hero)' }}>
        {/* Glow effects */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
        
        <div className="relative z-10 text-center max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 border border-primary/30 mb-6 animate-pulse-glow">
              <Flame className="w-10 h-10 text-primary" />
            </div>
            
            <h1 className="text-5xl md:text-7xl font-display font-bold mb-4">
              <span className="text-gradient">75 Hard</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-xl mx-auto">
              The ultimate mental toughness program. Track your progress, compete with friends, and transform your life.
            </p>

            <Button asChild size="lg" className="h-14 px-8 text-lg font-semibold">
              <Link to="/auth">
                Get Started
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
          </motion.div>

          {/* Features */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="grid md:grid-cols-3 gap-6 mt-20"
          >
            {[
              { icon: Target, title: 'Daily Tasks', desc: 'Track all 7 daily requirements' },
              { icon: Users, title: 'Group Challenges', desc: 'Compete with friends & family' },
              { icon: Trophy, title: 'Leaderboards', desc: 'Climb the ranks with points' },
            ].map((feature, i) => (
              <div key={i} className="p-6 rounded-2xl bg-card/50 border border-border/50 backdrop-blur-sm">
                <feature.icon className="w-8 h-8 text-primary mb-3" />
                <h3 className="font-display font-semibold text-lg mb-1">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.desc}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
