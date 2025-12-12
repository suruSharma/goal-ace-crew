import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Quote, Heart, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

interface FavoriteQuote {
  id: string;
  created_at: string;
  quotes: {
    text: string;
    author: string;
  };
}

interface FavoriteQuotesProps {
  userId: string;
}

export function FavoriteQuotes({ userId }: FavoriteQuotesProps) {
  const { toast } = useToast();
  const [quotes, setQuotes] = useState<FavoriteQuote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFavorites();
  }, [userId]);

  const fetchFavorites = async () => {
    try {
      const { data, error } = await supabase
        .from('favorite_quotes')
        .select('id, created_at, quotes(text, author)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuotes((data as unknown as FavoriteQuote[]) || []);
    } catch (error: any) {
      console.error('Error fetching favorites:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = async (id: string) => {
    try {
      await supabase
        .from('favorite_quotes')
        .delete()
        .eq('id', id);
      
      setQuotes(prev => prev.filter(q => q.id !== id));
      toast({ title: "Quote removed from favorites" });
    } catch (error: any) {
      toast({
        title: "Error removing quote",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  if (quotes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Heart className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No favorite quotes yet</p>
        <p className="text-xs mt-1">Click the heart icon on quotes you love to save them here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {quotes.map((quote, index) => (
          <motion.div
            key={quote.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ delay: index * 0.05 }}
            className="relative p-4 rounded-xl bg-secondary/50 border border-border group"
          >
            <Quote className="absolute top-3 left-3 w-4 h-4 text-primary/40" />
            <p className="text-sm italic text-muted-foreground pl-6 pr-8">
              "{quote.quotes.text}"
            </p>
            <p className="text-xs text-primary mt-2 text-right">
              — {quote.quotes.author}
            </p>
            <button
              onClick={() => removeFavorite(quote.id)}
              className="absolute top-3 right-3 p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all"
              title="Remove from favorites"
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
