import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';

const quotes = [
  { text: "The only easy day was yesterday.", author: "Navy SEALs" },
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
  { text: "The pain you feel today will be the strength you feel tomorrow.", author: "Unknown" },
  { text: "It's not about being the best. It's about being better than you were yesterday.", author: "Unknown" },
  { text: "Your body can stand almost anything. It's your mind that you have to convince.", author: "Unknown" },
  { text: "The difference between try and triumph is just a little umph!", author: "Marvin Phillips" },
  { text: "Mental toughness is doing the right thing for the team when it's not the best thing for you.", author: "Bill Belichick" },
  { text: "You don't have to be extreme, just consistent.", author: "Unknown" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { text: "The harder you work for something, the greater you'll feel when you achieve it.", author: "Unknown" },
  { text: "Don't limit your challenges. Challenge your limits.", author: "Unknown" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Strength does not come from physical capacity. It comes from an indomitable will.", author: "Mahatma Gandhi" },
  { text: "The body achieves what the mind believes.", author: "Napoleon Hill" },
  { text: "Hard work beats talent when talent doesn't work hard.", author: "Tim Notke" },
  { text: "You are only one workout away from a good mood.", author: "Unknown" },
  { text: "The struggle you're in today is developing the strength you need for tomorrow.", author: "Robert Tew" },
  { text: "Be stronger than your excuses.", author: "Unknown" },
  { text: "Champions are made when no one is watching.", author: "Unknown" },
  { text: "Embrace the pain, endure the struggle, enjoy the victory.", author: "Unknown" },
  { text: "You didn't come this far to only come this far.", author: "Unknown" },
  { text: "The only bad workout is the one that didn't happen.", author: "Unknown" },
  { text: "Push yourself because no one else is going to do it for you.", author: "Unknown" },
  { text: "Stay hard.", author: "David Goggins" },
  { text: "Who's gonna carry the boats?", author: "David Goggins" },
];

export function MotivationalQuote() {
  const quote = useMemo(() => {
    const today = new Date().toDateString();
    const seed = today.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return quotes[seed % quotes.length];
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="relative p-4 rounded-xl bg-primary/5 border border-primary/20"
    >
      <Quote className="absolute top-3 left-3 w-4 h-4 text-primary/40" />
      <p className="text-sm italic text-muted-foreground pl-6">
        "{quote.text}"
      </p>
      <p className="text-xs text-primary mt-2 text-right">
        — {quote.author}
      </p>
    </motion.div>
  );
}
