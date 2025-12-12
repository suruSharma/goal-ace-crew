import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Flame, Home, Trophy, Users, Clock, LogOut, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export function GlobalNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const isDashboard = location.pathname === '/dashboard';
  const [profileName, setProfileName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user!.id)
      .maybeSingle();
    
    if (data) {
      setProfileName(data.full_name || '');
      setAvatarUrl(data.avatar_url);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const isActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  };

  const getInitial = () => {
    if (profileName) return profileName.charAt(0).toUpperCase();
    return 'U';
  };

  return (
    <nav className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
      <div className="container max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Flame className="w-5 h-5 text-primary" />
          </div>
          <span className="font-display font-bold text-lg">75 Hard</span>
        </Link>
        
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
          <Link to="/profile">
            <div className={cn(
              "w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center text-primary-foreground font-semibold overflow-hidden cursor-pointer transition-all",
              isActive('/profile') ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'hover:ring-2 hover:ring-primary/30'
            )}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm">{getInitial()}</span>
              )}
            </div>
          </Link>
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </nav>
  );
}
