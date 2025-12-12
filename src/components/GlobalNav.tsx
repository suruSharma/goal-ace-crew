import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Flame, Home, Trophy, Users, Clock, User, LogOut, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

export function GlobalNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const isDashboard = location.pathname === '/dashboard';

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const isActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
      <div className="container max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!isDashboard && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate(-1)}
              className="shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Flame className="w-5 h-5 text-primary" />
            </div>
            <span className="font-display font-bold text-lg">75 Hard</span>
          </Link>
        </div>
        
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            asChild
            className={cn(isActive('/challenge-history') && 'bg-primary/10 text-primary')}
          >
            <Link to="/challenge-history">
              <Clock className="w-5 h-5" />
            </Link>
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            asChild
            className={cn(isActive('/achievements') && 'bg-primary/10 text-primary')}
          >
            <Link to="/achievements">
              <Trophy className="w-5 h-5" />
            </Link>
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            asChild
            className={cn(isActive('/groups') && 'bg-primary/10 text-primary')}
          >
            <Link to="/groups">
              <Users className="w-5 h-5" />
            </Link>
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            asChild
            className={cn(isActive('/profile') && 'bg-primary/10 text-primary')}
          >
            <Link to="/profile">
              <User className="w-5 h-5" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </nav>
  );
}
