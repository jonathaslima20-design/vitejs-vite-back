import { useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { toast } from 'sonner';
import { FormLabel, FormDescription } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/supabase';

interface ThemeToggleSectionProps {
  user: any;
  isDarkTheme: boolean;
  setIsDarkTheme: (isDark: boolean) => void;
}

export function ThemeToggleSection({ user, isDarkTheme, setIsDarkTheme }: ThemeToggleSectionProps) {
  const [loading, setLoading] = useState(false);

  const handleThemeToggle = async (checked: boolean) => {
    try {
      setLoading(true);
      const newTheme = checked ? 'dark' : 'light';

      const { error } = await supabase
        .from('users')
        .update({ theme: newTheme })
        .eq('id', user?.id);

      if (error) throw error;

      setIsDarkTheme(checked);
      toast.success('Tema atualizado com sucesso');
    } catch (error) {
      console.error('Error updating theme:', error);
      toast.error('Erro ao atualizar tema');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <FormLabel>Tema da Vitrine</FormLabel>
        <FormDescription>
          Escolha entre tema claro ou escuro para sua vitrine pública
        </FormDescription>
      </div>
      <div className="flex items-center space-x-2">
        <Sun className="h-4 w-4 text-muted-foreground" />
        <Switch
          checked={isDarkTheme}
          onCheckedChange={handleThemeToggle}
          disabled={loading}
        />
        <Moon className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}