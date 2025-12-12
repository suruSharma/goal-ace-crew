import { motion } from 'framer-motion';
import { Check, Dumbbell, Droplets, Book, Camera, Utensils, Wine } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskCardProps {
  name: string;
  description?: string;
  weight: number;
  completed: boolean;
  onToggle: () => void;
}

const getTaskIcon = (name: string) => {
  if (name.toLowerCase().includes('workout')) return Dumbbell;
  if (name.toLowerCase().includes('water')) return Droplets;
  if (name.toLowerCase().includes('read')) return Book;
  if (name.toLowerCase().includes('photo')) return Camera;
  if (name.toLowerCase().includes('diet')) return Utensils;
  if (name.toLowerCase().includes('alcohol')) return Wine;
  return Check;
};

export function TaskCard({ name, description, weight, completed, onToggle }: TaskCardProps) {
  const Icon = getTaskIcon(name);

  return (
    <motion.div
      layout
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onToggle}
      className={cn(
        "relative p-4 rounded-xl cursor-pointer transition-all duration-300 border",
        completed 
          ? "bg-primary/10 border-primary/30" 
          : "bg-card border-border hover:border-primary/30"
      )}
    >
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300",
            completed 
              ? "bg-primary text-primary-foreground" 
              : "bg-secondary text-muted-foreground"
          )}
        >
          {completed ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              <Check className="w-6 h-6" />
            </motion.div>
          ) : (
            <Icon className="w-6 h-6" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className={cn(
            "font-display font-semibold transition-colors",
            completed ? "text-primary" : "text-foreground"
          )}>
            {name}
          </h3>
          {description && (
            <p className="text-sm text-muted-foreground truncate">{description}</p>
          )}
        </div>

        <div className={cn(
          "px-3 py-1 rounded-full text-xs font-medium",
          completed ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
        )}>
          +{weight} pts
        </div>
      </div>

      {completed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{ boxShadow: '0 0 30px hsl(160 84% 45% / 0.15)' }}
        />
      )}
    </motion.div>
  );
}
