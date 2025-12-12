import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Flame, Trophy, Users, Clock, LogOut, Rss, UserPlus, BarChart3, Menu, X,
  Home
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { NotificationCenter } from '@/components/NotificationCenter';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

export function GlobalNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [profileName, setProfileName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchPendingRequestCount();
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

  const fetchPendingRequestCount = async () => {
    try {
      const { count } = await (supabase
        .from('friendships' as any)
        .select('*', { count: 'exact', head: true })
        .eq('addressee_id', user!.id)
        .eq('status', 'pending') as any);
      
      setPendingRequestCount(count || 0);
    } catch (error) {
      console.error('Error fetching pending request count:', error);
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

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: Home },
    { path: '/feed', label: 'Feed', icon: Rss },
    { path: '/friends', label: 'Friends', icon: UserPlus, badge: pendingRequestCount },
    { path: '/challenge-history', label: 'History', icon: Clock },
    { path: '/achievements', label: 'Achievements', icon: Trophy },
    { path: '/leaderboard', label: 'Leaderboard', icon: BarChart3 },
    { path: '/groups', label: 'Groups', icon: Users },
    { path: '/profile', label: 'Profile', icon: null, isProfile: true },
  ];

  return (
    <nav className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
      <div className="container max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Flame className="w-5 h-5 text-primary" />
          </div>
          <span className="font-display font-bold text-lg">75 Hard</span>
        </Link>
        
        <div className="flex items-center gap-2">
          {user && <NotificationCenter userId={user.id} />}
          
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Menu className="w-5 h-5" />
                {pendingRequestCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                  >
                    {pendingRequestCount > 9 ? '9+' : pendingRequestCount}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center text-primary-foreground font-semibold overflow-hidden"
                  )}>
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm">{getInitial()}</span>
                    )}
                  </div>
                  <span>{profileName || 'User'}</span>
                </SheetTitle>
              </SheetHeader>
              
              <div className="mt-6 space-y-1">
                {navItems.map((item) => {
                  if (item.isProfile) {
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                          isActive(item.path) 
                            ? "bg-primary/10 text-primary" 
                            : "hover:bg-muted"
                        )}
                      >
                        <div className={cn(
                          "w-6 h-6 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center text-primary-foreground text-xs font-semibold overflow-hidden"
                        )}>
                          {avatarUrl ? (
                            <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                          ) : (
                            <span>{getInitial()}</span>
                          )}
                        </div>
                        <span className="font-medium">{item.label}</span>
                      </Link>
                    );
                  }

                  const Icon = item.icon!;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors relative",
                        isActive(item.path) 
                          ? "bg-primary/10 text-primary" 
                          : "hover:bg-muted"
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{item.label}</span>
                      {item.badge && item.badge > 0 && (
                        <Badge 
                          variant="destructive" 
                          className="ml-auto h-5 min-w-5 px-1.5 flex items-center justify-center text-xs"
                        >
                          {item.badge > 9 ? '9+' : item.badge}
                        </Badge>
                      )}
                    </Link>
                  );
                })}
              </div>

              <div className="mt-6 pt-4 border-t border-border">
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    handleSignOut();
                    setOpen(false);
                  }} 
                  className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="w-5 h-5 mr-3" />
                  Logout
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}