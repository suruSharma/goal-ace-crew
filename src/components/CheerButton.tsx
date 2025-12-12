import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Loader2 } from 'lucide-react';

interface CheerButtonProps {
  fromUserId: string;
  toUserId: string;
  toUserName: string;
  groupId: string;
  existingCheers?: { emoji: string; count: number }[];
}

const CHEER_EMOJIS = ['🔥', '💪', '⭐', '🏆', '👏', '🚀', '❤️', '🎯'];

export function CheerButton({ 
  fromUserId, 
  toUserId, 
  toUserName,
  groupId,
  existingCheers = []
}: CheerButtonProps) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(false);

  const handleCheer = async (emoji: string) => {
    if (fromUserId === toUserId) {
      toast({
        title: "Can't cheer yourself!",
        description: "Send cheers to your teammates instead.",
        variant: "destructive"
      });
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase
        .from('cheers')
        .insert({
          from_user_id: fromUserId,
          to_user_id: toUserId,
          group_id: groupId,
          emoji
        });

      if (error) throw error;

      toast({
        title: `${emoji} Cheer sent!`,
        description: `You encouraged ${toUserName}!`
      });
      setOpen(false);
    } catch (error: any) {
      toast({
        title: "Error sending cheer",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {existingCheers.length > 0 && (
        <div className="flex items-center gap-0.5 mr-1">
          {existingCheers.slice(0, 3).map((cheer, idx) => (
            <span key={idx} className="text-sm" title={`${cheer.count} ${cheer.emoji}`}>
              {cheer.emoji}
              {cheer.count > 1 && (
                <span className="text-xs text-muted-foreground">{cheer.count}</span>
              )}
            </span>
          ))}
        </div>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 px-2 text-xs"
            disabled={sending || fromUserId === toUserId}
          >
            {sending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              "👏"
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="end">
          <div className="grid grid-cols-4 gap-1">
            {CHEER_EMOJIS.map(emoji => (
              <Button
                key={emoji}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-lg hover:scale-125 transition-transform"
                onClick={() => handleCheer(emoji)}
              >
                {emoji}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}