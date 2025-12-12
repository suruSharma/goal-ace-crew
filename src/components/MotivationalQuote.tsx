import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Quote, Heart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Quote {
  id: string;
  text: string;
  author: string;
}

interface MotivationalQuoteProps {
  userId?: string;
}

export function MotivationalQuote({ userId }: MotivationalQuoteProps) {
  const { toast } = useToast();
  const [isFavorite, setIsFavorite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch a random quote from the database
  useEffect(() => {
    const fetchRandomQuote = async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('id, text, author');
      
      if (error || !data || data.length === 0) {
        console.error('Error fetching quotes:', error);
        setLoading(false);
        return;
      }
      
      const randomIndex = Math.floor(Math.random() * data.length);
      setQuote(data[randomIndex]);
      setLoading(false);
    };
    
    fetchRandomQuote();
  }, []);

  // Check if this quote is already a favorite
  useEffect(() => {
    const checkFavorite = async () => {
      if (!userId || !quote) return;
      const { data } = await supabase
        .from('favorite_quotes')
        .select('id')
        .eq('user_id', userId)
        .eq('quote_text', quote.text)
        .maybeSingle();
      setIsFavorite(!!data);
    };
    checkFavorite();
  }, [userId, quote]);

  const toggleFavorite = async () => {
    if (!userId || !quote) return;
    setSaving(true);

    try {
      if (isFavorite) {
        // Remove from favorites
        await supabase
          .from('favorite_quotes')
          .delete()
          .eq('user_id', userId)
          .eq('quote_text', quote.text);
        setIsFavorite(false);
        toast({ title: "Removed from favorites" });
      } else {
        // Add to favorites
        await supabase
          .from('favorite_quotes')
          .insert({
            user_id: userId,
            quote_text: quote.text,
            quote_author: quote.author
          });
        setIsFavorite(true);
        toast({ title: "Added to favorites!" });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 animate-pulse">
        <div className="h-4 bg-primary/10 rounded w-3/4 mb-2"></div>
        <div className="h-3 bg-primary/10 rounded w-1/4 ml-auto"></div>
      </div>
    );
  }

  if (!quote) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="relative p-4 rounded-xl bg-primary/5 border border-primary/20"
    >
      <Quote className="absolute top-3 left-3 w-4 h-4 text-primary/40" />
      <p className="text-sm italic text-muted-foreground pl-6 pr-8">
        "{quote.text}"
      </p>
      <p className="text-xs text-primary mt-2 text-right">
        — {quote.author}
      </p>
      {userId && (
        <button
          onClick={toggleFavorite}
          disabled={saving}
          className="absolute top-3 right-3 p-1 rounded-full hover:bg-primary/10 transition-colors"
          title={isFavorite ? "Remove from favorites" : "Save to favorites"}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={isFavorite ? 'filled' : 'empty'}
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
            >
              <Heart 
                className={`w-4 h-4 transition-colors ${
                  isFavorite 
                    ? 'fill-red-500 text-red-500' 
                    : 'text-muted-foreground hover:text-red-400'
                }`}
              />
            </motion.div>
          </AnimatePresence>
        </button>
      )}
    </motion.div>
  );
}
