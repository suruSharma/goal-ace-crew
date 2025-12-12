import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Flame, Home } from 'lucide-react';

interface AppHeaderProps {
  title: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export function AppHeader({ title, icon, children }: AppHeaderProps) {
  return (
    <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
      <div className="container max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link to="/dashboard">
              <Home className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            {icon}
            <span className="font-display font-bold text-lg md:text-xl">{title}</span>
          </div>
        </div>
        
        {children && (
          <div className="flex items-center gap-2">
            {children}
          </div>
        )}
      </div>
    </header>
  );
}
