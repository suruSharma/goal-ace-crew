import { useTheme, ColorTheme } from '@/hooks/useTheme';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Moon, Sun, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';

const colorThemes: { id: ColorTheme; name: string; color: string }[] = [
  { id: 'purple', name: 'Purple', color: 'bg-violet-500' },
  { id: 'coral', name: 'Coral', color: 'bg-orange-500' },
  { id: 'emerald', name: 'Emerald', color: 'bg-emerald-500' },
  { id: 'blue', name: 'Blue', color: 'bg-blue-500' },
];

export function ThemeSettings() {
  const { colorTheme, mode, setColorTheme, toggleMode } = useTheme();

  return (
    <div className="space-y-6">
      {/* Dark/Light Mode Toggle */}
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          {mode === 'dark' ? (
            <Moon className="w-4 h-4 text-muted-foreground" />
          ) : (
            <Sun className="w-4 h-4 text-muted-foreground" />
          )}
          Dark Mode
        </Label>
        <Switch
          checked={mode === 'dark'}
          onCheckedChange={toggleMode}
        />
      </div>

      {/* Color Theme Selection */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-muted-foreground" />
          Color Theme
        </Label>
        <div className="grid grid-cols-4 gap-3">
          {colorThemes.map((theme) => (
            <button
              key={theme.id}
              onClick={() => setColorTheme(theme.id)}
              className={cn(
                "flex flex-col items-center gap-2 p-3 rounded-lg border transition-all",
                colorTheme === theme.id
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50 bg-secondary/30"
              )}
            >
              <div className={cn("w-8 h-8 rounded-full", theme.color)} />
              <span className="text-xs font-medium">{theme.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
