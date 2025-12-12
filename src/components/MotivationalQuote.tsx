import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';

const quotes = [
  // Navy SEALs & Military
  { text: "The only easy day was yesterday.", author: "Navy SEALs" },
  
  // Leaders & Historical Figures
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
  { text: "The difference between try and triumph is just a little umph!", author: "Marvin Phillips" },
  { text: "Mental toughness is doing the right thing for the team when it is not the best thing for you.", author: "Bill Belichick" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Strength does not come from physical capacity. It comes from an indomitable will.", author: "Mahatma Gandhi" },
  { text: "The body achieves what the mind believes.", author: "Napoleon Hill" },
  { text: "Hard work beats talent when talent does not work hard.", author: "Tim Notke" },
  { text: "The struggle you are in today is developing the strength you need for tomorrow.", author: "Robert Tew" },
  { text: "Stay hard.", author: "David Goggins" },
  { text: "Who is gonna carry the boats?", author: "David Goggins" },
  
  // Athletes
  { text: "I have failed over and over again in my life. And that is why I succeed.", author: "Michael Jordan" },
  { text: "The more difficult the victory, the greater the happiness in winning.", author: "Pelé" },
  { text: "Excellence is not a singular act, but a habit. You are what you repeatedly do.", author: "Shaquille O'Neal" },
  { text: "Set your goals high, and do not stop till you get there.", author: "Bo Jackson" },
  { text: "If you are afraid of failure, you do not deserve to be successful.", author: "Charles Barkley" },
  { text: "Impossible is just a big word thrown around by small men.", author: "Muhammad Ali" },
  { text: "Float like a butterfly, sting like a bee.", author: "Muhammad Ali" },
  { text: "I am not the greatest, I am the double greatest.", author: "Muhammad Ali" },
  { text: "Suffer now and live the rest of your life as a champion.", author: "Muhammad Ali" },
  { text: "The fight is won or lost far away from witnesses.", author: "Muhammad Ali" },
  { text: "Do not count the days, make the days count.", author: "Muhammad Ali" },
  { text: "Age is whatever you think it is. You are as old as you think you are.", author: "Muhammad Ali" },
  { text: "It is not the will to win that matters. Everyone has that. It is the will to prepare to win.", author: "Paul Bear Bryant" },
  { text: "Winning is not everything, but wanting to win is.", author: "Vince Lombardi" },
  { text: "The price of excellence is discipline. The cost of mediocrity is disappointment.", author: "William Arthur Ward" },
  { text: "Gold medals are not really made of gold. They are made of sweat and determination.", author: "Dan Gable" },
  { text: "You miss 100% of the shots you do not take.", author: "Wayne Gretzky" },
  { text: "I hated every minute of training, but I said do not quit.", author: "Muhammad Ali" },
  { text: "The only way to prove you are a good sport is to lose.", author: "Ernie Banks" },
  { text: "Pain is temporary. Quitting lasts forever.", author: "Lance Armstrong" },
  { text: "There may be people that have more talent than you, but there is no excuse for anyone to work harder.", author: "Derek Jeter" },
  { text: "Today I will do what others will not, so tomorrow I can accomplish what others cannot.", author: "Jerry Rice" },
  { text: "When you want to succeed as bad as you want to breathe, then you will be successful.", author: "Eric Thomas" },
  { text: "The successful warrior is the average man, with laser-like focus.", author: "Bruce Lee" },
  { text: "I fear not the man who has practiced 10,000 kicks once, but the man who has practiced one kick 10,000 times.", author: "Bruce Lee" },
  { text: "Defeat is not the worst of failures. Not to have tried is the true failure.", author: "George Edward Woodberry" },
  { text: "A champion is someone who gets up when they cannot.", author: "Jack Dempsey" },
  
  // Entrepreneurs
  { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
  { text: "Your time is limited, do not waste it living someone else is life.", author: "Steve Jobs" },
  { text: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
  { text: "Stay hungry. Stay foolish.", author: "Steve Jobs" },
  { text: "Move fast and break things. Unless you are breaking stuff, you are not moving fast enough.", author: "Mark Zuckerberg" },
  { text: "The biggest risk is not taking any risk.", author: "Mark Zuckerberg" },
  { text: "It is fine to celebrate success but it is more important to heed the lessons of failure.", author: "Bill Gates" },
  { text: "Do not be afraid to give up the good to go for the great.", author: "John D. Rockefeller" },
  { text: "I never dreamed about success. I worked for it.", author: "Estée Lauder" },
  { text: "The question is not who is going to let me; it is who is going to stop me.", author: "Ayn Rand" },
  { text: "If you are not embarrassed by the first version of your product, you have launched too late.", author: "Reid Hoffman" },
  { text: "Chase the vision, not the money; the money will end up following you.", author: "Tony Hsieh" },
  { text: "When something is important enough, you do it even if the odds are not in your favor.", author: "Elon Musk" },
  { text: "Failure is an option here. If things are not failing, you are not innovating enough.", author: "Elon Musk" },
  { text: "If you want to live a happy life, tie it to a goal, not to people or things.", author: "Albert Einstein" },
  { text: "Do not be distracted by criticism. Remember, the only taste of success some people get is to take a bite out of you.", author: "Zig Ziglar" },
  { text: "Winners are not afraid of losing. But losers are.", author: "Robert Kiyosaki" },
  { text: "I am convinced that about half of what separates successful entrepreneurs from the non-successful ones is pure perseverance.", author: "Steve Jobs" },
  { text: "If you really look closely, most overnight successes took a long time.", author: "Steve Jobs" },
  { text: "The only limit to our realization of tomorrow is our doubts of today.", author: "Franklin D. Roosevelt" },
  
  // Philosophers
  { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Aristotle" },
  { text: "No man is free who is not master of himself.", author: "Epictetus" },
  { text: "The impediment to action advances action. What stands in the way becomes the way.", author: "Marcus Aurelius" },
  { text: "You have power over your mind, not outside events. Realize this, and you will find strength.", author: "Marcus Aurelius" },
  { text: "Waste no more time arguing about what a good man should be. Be one.", author: "Marcus Aurelius" },
  { text: "It is not death that a man should fear, but he should fear never beginning to live.", author: "Marcus Aurelius" },
  { text: "Very little is needed to make a happy life; it is all within yourself, in your way of thinking.", author: "Marcus Aurelius" },
  { text: "First say to yourself what you would be; and then do what you have to do.", author: "Epictetus" },
  { text: "Difficulties strengthen the mind, as labor does the body.", author: "Seneca" },
  { text: "It is not that we have a short time to live, but that we waste a lot of it.", author: "Seneca" },
  { text: "Luck is what happens when preparation meets opportunity.", author: "Seneca" },
  { text: "He who has a why to live can bear almost any how.", author: "Friedrich Nietzsche" },
  { text: "That which does not kill us makes us stronger.", author: "Friedrich Nietzsche" },
  { text: "The secret of change is to focus all your energy not on fighting the old, but on building the new.", author: "Socrates" },
  { text: "An unexamined life is not worth living.", author: "Socrates" },
  { text: "To find yourself, think for yourself.", author: "Socrates" },
  { text: "Knowing yourself is the beginning of all wisdom.", author: "Aristotle" },
  { text: "Happiness depends upon ourselves.", author: "Aristotle" },
  { text: "Quality is not an act, it is a habit.", author: "Aristotle" },
  { text: "I think therefore I am.", author: "René Descartes" },
  { text: "The mind is everything. What you think you become.", author: "Buddha" },
  { text: "Peace comes from within. Do not seek it without.", author: "Buddha" },
  { text: "The only true wisdom is in knowing you know nothing.", author: "Socrates" },
  { text: "Out of difficulties grow miracles.", author: "Jean de La Bruyère" },
  { text: "Patience is bitter, but its fruit is sweet.", author: "Aristotle" },
  { text: "Begin at once to live, and count each separate day as a separate life.", author: "Seneca" },
  { text: "A gem cannot be polished without friction, nor a man perfected without trials.", author: "Seneca" },
  { text: "Associate with people who are likely to improve you.", author: "Seneca" },
  { text: "The soul becomes dyed with the color of its thoughts.", author: "Marcus Aurelius" },
  { text: "When we are no longer able to change a situation, we are challenged to change ourselves.", author: "Viktor Frankl" },
  { text: "Everything can be taken from a man but one thing: the freedom to choose his attitude.", author: "Viktor Frankl" },
  
  // Indian Authors & Leaders
  { text: "You must be the change you wish to see in the world.", author: "Mahatma Gandhi" },
  { text: "Live as if you were to die tomorrow. Learn as if you were to live forever.", author: "Mahatma Gandhi" },
  { text: "The future depends on what you do today.", author: "Mahatma Gandhi" },
  { text: "In a gentle way, you can shake the world.", author: "Mahatma Gandhi" },
  { text: "Arise, awake, and stop not till the goal is reached.", author: "Swami Vivekananda" },
  { text: "All the powers in the universe are already ours. It is we who have put our hands before our eyes and cry that it is dark.", author: "Swami Vivekananda" },
  { text: "Take risks in your life. If you win, you can lead. If you lose, you can guide.", author: "Swami Vivekananda" },
  { text: "You cannot believe in God until you believe in yourself.", author: "Swami Vivekananda" },
  { text: "The greatest sin is to think yourself weak.", author: "Swami Vivekananda" },
  { text: "Dream, dream, dream. Dreams transform into thoughts and thoughts result in action.", author: "A.P.J. Abdul Kalam" },
  { text: "If you want to shine like a sun, first burn like a sun.", author: "A.P.J. Abdul Kalam" },
  { text: "Do not read success stories, you will only get a message. Read failure stories, you will get some ideas to get success.", author: "A.P.J. Abdul Kalam" },
  { text: "Man needs difficulties because to enjoy success he needs to struggle first.", author: "A.P.J. Abdul Kalam" },
  { text: "All birds find shelter during rain. But the eagle avoids rain by flying above the clouds.", author: "A.P.J. Abdul Kalam" },
  { text: "You have to dream before your dreams can come true.", author: "A.P.J. Abdul Kalam" },
  { text: "Where there is a will, there is a way.", author: "Rabindranath Tagore" },
  { text: "You cannot cross the sea merely by standing and staring at the water.", author: "Rabindranath Tagore" },
  { text: "The butterfly counts not months but moments, and has time enough.", author: "Rabindranath Tagore" },
  { text: "Faith is the bird that feels the light when the dawn is still dark.", author: "Rabindranath Tagore" },
  { text: "A person who never made a mistake never tried anything new.", author: "Chanakya" },
  { text: "Education is the best friend. An educated person is respected everywhere.", author: "Chanakya" },
  { text: "Once you start working on something, do not be afraid of failure and do not abandon it.", author: "Chanakya" },
  { text: "The world is changed by your example, not by your opinion.", author: "Chanakya" },
  { text: "If you do not build your dream, someone else will hire you to help them build theirs.", author: "Dhirubhai Ambani" },
  { text: "Think big, think fast, think ahead. Ideas are no one is monopoly.", author: "Dhirubhai Ambani" },
  { text: "Between your preparation and your ambition lies the reality.", author: "Dhirubhai Ambani" },
  { text: "I give importance to hard work and not to the talent.", author: "Ratan Tata" },
  { text: "Take the stones people throw at you and use them to build a monument.", author: "Ratan Tata" },
  { text: "Ups and downs in life are very important to keep us going, because a straight line even in an ECG means we are not alive.", author: "Ratan Tata" },
  { text: "None can destroy iron, but its own rust can. Likewise, none can destroy a person, but his own mindset can.", author: "Ratan Tata" },
  { text: "The only thing standing between you and your goal is the story you keep telling yourself.", author: "Sadhguru" },
  { text: "If you resist change, you resist life.", author: "Sadhguru" },
  { text: "Do not wait for the perfect moment. Take the moment and make it perfect.", author: "Sadhguru" },
];

export function MotivationalQuote() {
  // Use session-based random selection (changes on each login/page refresh)
  const quote = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * quotes.length);
    return quotes[randomIndex];
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
