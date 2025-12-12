import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Flame, Home, Trophy, Users, Clock, User } from 'lucide-react';

export function GlobalNav() {
  const location = useLocation();
  const isDashboard = location.pathname === '/dashboard';

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
          {!isDashboard && (
            <Button variant="ghost" size="icon" asChild>
              <Link to="/dashboard">
                <Home className="w-5 h-5" />
              </Link>
            </Button>
          )}
          <Button variant="ghost" size="icon" asChild>
            <Link to="/challenge-history">
              <Clock className="w-5 h-5" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <Link to="/achievements">
              <Trophy className="w-5 h-5" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <Link to="/groups">
              <Users className="w-5 h-5" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <Link to="/profile">
              <User className="w-5 h-5" />
            </Link>
          </Button>
        </div>
      </div>
    </nav>
  );
}
