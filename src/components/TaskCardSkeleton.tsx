import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';

export function TaskCardSkeleton() {
  return (
    <div className="relative p-4 rounded-xl border bg-card border-border">
      <div className="flex items-center gap-4">
        <Skeleton className="w-12 h-12 rounded-full" />
        
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>

        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    </div>
  );
}

export function TaskCardSkeletonGroup({ count = 5 }: { count?: number }) {
  return (
    <div className="grid gap-3">
      {Array.from({ length: count }).map((_, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <TaskCardSkeleton />
        </motion.div>
      ))}
    </div>
  );
}
