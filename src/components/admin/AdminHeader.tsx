import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useAuth } from '@/contexts/AuthContext';
import { getInitials } from '@/lib/utils';

export default function AdminHeader() {
  const { user } = useAuth();
  
  return (
    <header className="border-b bg-background py-3 px-4 lg:px-8 flex items-center justify-between">
      <div>
        <h1 className="font-semibold text-xl">Painel Administrativo</h1>
      </div>
      
      <div className="flex items-center space-x-4">
        <ThemeToggle />
        
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-primary"></span>
        </Button>
        
        <div className="flex items-center space-x-3">
          <Avatar>
            <AvatarImage src={user?.avatar_url} alt={user?.name} />
            <AvatarFallback>{getInitials(user?.name || '')}</AvatarFallback>
          </Avatar>
          <div className="hidden md:block">
            <p className="font-medium text-sm">{user?.name}</p>
            <p className="text-xs text-muted-foreground">Administrador</p>
          </div>
        </div>
      </div>
    </header>
  );
}