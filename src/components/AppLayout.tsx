import { useLocation } from 'react-router-dom';
import { GlobalNav } from './GlobalNav';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  
  // Don't show nav on public pages (landing, auth)
  const hideNav = ['/', '/auth'].includes(location.pathname);

  return (
    <div className="min-h-screen bg-background">
      {!hideNav && <GlobalNav />}
      {children}
    </div>
  );
}
