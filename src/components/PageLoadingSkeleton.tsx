import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { Flame } from 'lucide-react';

export function PageLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header skeleton */}
      <header className="border-b border-border">
        <div className="container max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Flame className="w-5 h-5 text-primary animate-pulse" />
            </div>
            <Skeleton className="h-6 w-24" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="w-9 h-9 rounded-full" />
            <Skeleton className="w-9 h-9 rounded-full" />
          </div>
        </div>
      </header>

      {/* Content skeleton */}
      <main className="container max-w-6xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-8"
        >
          {/* Welcome section */}
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-5 w-96" />
          </div>

          {/* Stats grid */}
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-card rounded-2xl border border-border p-6 skeleton-shimmer">
              <div className="flex items-center justify-between">
                <Skeleton className="w-24 h-24 rounded-full" />
                <div className="flex items-center gap-8">
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="w-24 h-24 rounded-full" />
                </div>
              </div>
            </div>
            <div className="bg-card rounded-2xl border border-border p-6 skeleton-shimmer">
              <Skeleton className="h-6 w-20 mb-4" />
              <div className="space-y-4">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-12" />
                </div>
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-8" />
                </div>
              </div>
            </div>
          </div>

          {/* Tasks section */}
          <div className="space-y-4">
            <Skeleton className="h-7 w-40" />
            <div className="grid gap-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-4 rounded-xl border bg-card border-border skeleton-shimmer"
                >
                  <div className="flex items-center gap-4">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

export function SimpleLoadingSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center skeleton-shimmer">
          <Flame className="w-8 h-8 text-primary" />
        </div>
        <div className="space-y-2 text-center">
          <Skeleton className="h-4 w-32 mx-auto" />
          <Skeleton className="h-3 w-24 mx-auto" />
        </div>
      </motion.div>
    </div>
  );
}
