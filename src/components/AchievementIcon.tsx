import { 
  Flame, Trophy, Star, Crown, Gem, Medal, Award, Target, Zap, 
  Rocket, Heart, Shield, Sparkles, Gift, type LucideIcon
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  flame: Flame,
  trophy: Trophy,
  star: Star,
  crown: Crown,
  gem: Gem,
  medal: Medal,
  award: Award,
  target: Target,
  zap: Zap,
  rocket: Rocket,
  heart: Heart,
  shield: Shield,
  sparkles: Sparkles,
  gift: Gift,
};

interface AchievementIconProps {
  icon: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function AchievementIcon({ icon, className = '', size = 'md' }: AchievementIconProps) {
  const IconComponent = iconMap[icon.toLowerCase()] || Trophy;
  
  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };
  
  return <IconComponent className={`${sizeClasses[size]} ${className}`} />;
}
