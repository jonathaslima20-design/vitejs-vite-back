import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MoveHorizontal as MoreHorizontal, CreditCard as Edit, Ban, CircleCheck as CheckCircle, Trash2, MessageCircle, Phone, Instagram, MapPin, ExternalLink, Shield, Users, User as UserIcon, Key, Copy, Eye, EyeOff, Loader as Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getInitials, formatWhatsAppForDisplay, generateWhatsAppUrl } from '@/lib/utils';
import PlanStatusBadge from '@/components/subscription/PlanStatusBadge';
import { changeUserPassword } from '@/lib/adminApi';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import type { User } from '@/types';

const passwordFormSchema = z.object({
  newPassword: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

interface UserTableProps {
  users: User[];
  selectedUsers: Set<string>;
  onSelectUser: (userId: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onToggleBlock: (userId: string, currentBlocked: boolean) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
  loading: boolean;
  currentUserRole: string;
}

export function UserTable({
  users,
  selectedUsers,
  onSelectUser,
  onSelectAll,
  onToggleBlock,
  onDeleteUser,
  loading,
  currentUserRole
}: UserTableProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  const allSelected = users.length > 0 && users.every(user => selectedUsers.has(user.id));
  const someSelected = selectedUsers.size > 0 && !allSelected;

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="h-4 w-4 text-red-500" />;
      case 'parceiro':
        return <Users className="h-4 w-4 text-blue-500" />;
      default:
        return <UserIcon className="h-4 w-4 text-green-500" />;
    }
  };

  const getRoleText = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Admin';
      case 'parceiro':
        return 'Parceiro';
      default:
        return 'Vendedor';
    }
  };

  const handleToggleBlock = async (userId: string, currentBlocked: boolean) => {
    try {
      setActionLoading(userId);
      await onToggleBlock(userId, currentBlocked);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      setActionLoading(userId);
      await onDeleteUser(userId);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePasswordChange = async (values: z.infer<typeof passwordFormSchema>) => {
    if (!selectedUserId) return;

    try {
      setChangingPassword(true);
      await changeUserPassword(selectedUserId, values.newPassword);
      toast.success('Senha alterada com sucesso');
      setShowPasswordDialog(false);
      passwordForm.reset();
      setSelectedUserId(null);
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error(error.message || 'Erro ao alterar senha');
    } finally {
      setChangingPassword(false);
    }
  };

  const openPasswordDialog = (userId: string) => {
    setSelectedUserId(userId);
    setShowPasswordDialog(true);
    passwordForm.reset();
  };

  const openCloneUser = (userId: string) => {
    // Navigate to user detail page where clone functionality exists
    window.location.href = `/admin/users/${userId}`;
  };

  if (users.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Nenhum usuário encontrado</h3>
        <p className="text-muted-foreground">
          Tente ajustar os filtros ou criar um novo usuário
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile Card Layout */}
      <div className="block md:hidden space-y-4">
        {users.map((user) => (
          <Card key={user.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Checkbox
                    checked={selectedUsers.has(user.id)}
                    onCheckedChange={(checked) => onSelectUser(user.id, checked as boolean)}
                    aria-label={`Selecionar ${user.name}`}
                  />
                  <Avatar className="h-12 w-12 flex-shrink-0">
                    <AvatarImage src={user.avatar_url} alt={user.name} />
                    <AvatarFallback className="text-sm">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{user.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                    {user.slug && (
                      <div className="text-xs text-primary truncate">/{user.slug}</div>
                    )}
                  </div>
                </div>

                {/* Actions Dropdown - Always Visible */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Ações do Usuário</DropdownMenuLabel>
                    
                    <DropdownMenuItem asChild>
                      <Link to={`/admin/users/${user.id}`}>
                        <Edit className="h-4 w-4 mr-2" />
                        Ver Detalhes
                      </Link>
                    </DropdownMenuItem>

                    {/* Admin-only actions */}
                    {currentUserRole === 'admin' && (
                      <>
                        <DropdownMenuItem onClick={() => openPasswordDialog(user.id)}>
                          <Key className="h-4 w-4 mr-2" />
                          Alterar Senha
                        </DropdownMenuItem>

                        <DropdownMenuItem onClick={() => window.dispatchEvent(new CustomEvent('openClonePanel', { detail: { targetUserId: user.id } }))}>
                          <Copy className="h-4 w-4 mr-2" />
                          Sistema de Clonagem
                        </DropdownMenuItem>
                      </>
                    )}

                    <DropdownMenuSeparator />

                    {user.whatsapp && (
                      <DropdownMenuItem asChild>
                        <a
                          href={generateWhatsAppUrl(user.whatsapp, `Olá ${user.name}, como posso ajudar?`)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MessageCircle className="h-4 w-4 mr-2" />
                          WhatsApp
                        </a>
                      </DropdownMenuItem>
                    )}

                    {user.phone && (
                      <DropdownMenuItem asChild>
                        <a href={`tel:${user.phone}`}>
                          <Phone className="h-4 w-4 mr-2" />
                          Ligar
                        </a>
                      </DropdownMenuItem>
                    )}

                    {user.instagram && (
                      <DropdownMenuItem asChild>
                        <a 
                          href={`https://instagram.com/${user.instagram}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          <Instagram className="h-4 w-4 mr-2" />
                          Instagram
                        </a>
                      </DropdownMenuItem>
                    )}

                    {user.slug && (
                      <DropdownMenuItem asChild>
                        <a 
                          href={`/${user.slug}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Ver Vitrine
                        </a>
                      </DropdownMenuItem>
                    )}

                    {user.location_url && (
                      <DropdownMenuItem asChild>
                        <a 
                          href={user.location_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          <MapPin className="h-4 w-4 mr-2" />
                          Localização
                        </a>
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      onClick={() => handleToggleBlock(user.id, user.is_blocked)}
                      disabled={actionLoading === user.id}
                      className={user.is_blocked ? 'text-green-600' : 'text-red-600'}
                    >
                      {user.is_blocked ? (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Desbloquear
                        </>
                      ) : (
                        <>
                          <Ban className="h-4 w-4 mr-2" />
                          Bloquear
                        </>
                      )}
                    </DropdownMenuItem>

                    {/* Only show delete for non-admin users or if current user is admin */}
                    {(user.role !== 'admin' || currentUserRole === 'admin') && (
                      <>
                        <DropdownMenuSeparator />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem
                              onSelect={(e) => e.preventDefault()}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir o usuário "{user.name}"? 
                                Esta ação não pode ser desfeita e todos os dados associados serão removidos.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteUser(user.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir Usuário
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              <div className="space-y-3">
                {/* Role and Plan Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getRoleIcon(user.role)}
                    <span className="text-sm font-medium">{getRoleText(user.role)}</span>
                  </div>
                  <PlanStatusBadge status={user.plan_status} />
                </div>

                {/* User Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  {user.is_blocked ? (
                    <Badge variant="destructive" className="text-xs">
                      <Ban className="h-3 w-3 mr-1" />
                      Bloqueado
                    </Badge>
                  ) : (
                    <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Ativo
                    </Badge>
                  )}
                </div>

                {/* WhatsApp */}
                {user.whatsapp && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">WhatsApp:</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                      asChild
                    >
                      <a
                        href={generateWhatsAppUrl(user.whatsapp, `Olá ${user.name}, como posso ajudar?`)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageCircle className="h-4 w-4 mr-1" />
                        <span className="text-xs font-mono">
                          {formatWhatsAppForDisplay(user.whatsapp)}
                        </span>
                      </a>
                    </Button>
                  </div>
                )}

                {/* Created Date */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Cadastrado:</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(user.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop Table Layout */}
      <div className="hidden md:block rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={onSelectAll}
                  aria-label="Selecionar todos"
                  className={someSelected ? "data-[state=checked]:bg-primary" : ""}
                />
              </TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Função</TableHead>
              <TableHead className="hidden lg:table-cell">WhatsApp</TableHead>
              <TableHead>Status do Plano</TableHead>
              <TableHead className="hidden xl:table-cell">Status</TableHead>
              <TableHead className="hidden lg:table-cell">Cadastrado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} className="hover:bg-muted/50">
                <TableCell>
                  <Checkbox
                    checked={selectedUsers.has(user.id)}
                    onCheckedChange={(checked) => onSelectUser(user.id, checked as boolean)}
                    aria-label={`Selecionar ${user.name}`}
                  />
                </TableCell>
                
                {/* User Info */}
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatar_url} alt={user.name} />
                      <AvatarFallback className="text-sm">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{user.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                      {user.slug && (
                        <div className="text-xs text-primary truncate">
                          /{user.slug}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>

                {/* Role */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getRoleIcon(user.role)}
                    <span className="text-sm">{getRoleText(user.role)}</span>
                  </div>
                </TableCell>

                {/* WhatsApp */}
                <TableCell className="hidden lg:table-cell">
                  {user.whatsapp ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                            asChild
                          >
                            <a
                              href={generateWhatsAppUrl(user.whatsapp, `Olá ${user.name}, como posso ajudar?`)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <MessageCircle className="h-4 w-4 mr-1" />
                              <span className="text-xs font-mono">
                                {formatWhatsAppForDisplay(user.whatsapp)}
                              </span>
                            </a>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Abrir conversa no WhatsApp</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <span className="text-xs text-muted-foreground">Não informado</span>
                  )}
                </TableCell>

                {/* Plan Status */}
                <TableCell>
                  <PlanStatusBadge status={user.plan_status} />
                </TableCell>

                {/* User Status */}
                <TableCell className="hidden xl:table-cell">
                  {user.is_blocked ? (
                    <Badge variant="destructive" className="text-xs">
                      <Ban className="h-3 w-3 mr-1" />
                      Bloqueado
                    </Badge>
                  ) : (
                    <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Ativo
                    </Badge>
                  )}
                </TableCell>

                {/* Created Date */}
                <TableCell className="hidden lg:table-cell">
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(user.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </TableCell>

                {/* Actions */}
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {/* Quick Block/Unblock - Hidden on mobile */}
                    <div className="hidden md:block">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-8 w-8 p-0 ${
                                user.is_blocked 
                                  ? 'text-green-600 hover:text-green-700 hover:bg-green-50' 
                                  : 'text-red-600 hover:text-red-700 hover:bg-red-50'
                              }`}
                              onClick={() => handleToggleBlock(user.id, user.is_blocked)}
                              disabled={actionLoading === user.id || loading}
                            >
                              {actionLoading === user.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : user.is_blocked ? (
                                <CheckCircle className="h-4 w-4" />
                              ) : (
                                <Ban className="h-4 w-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{user.is_blocked ? 'Desbloquear usuário' : 'Bloquear usuário'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    {/* More Actions Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>Ações do Usuário</DropdownMenuLabel>
                        
                        <DropdownMenuItem asChild>
                          <Link to={`/admin/users/${user.id}`}>
                            <Edit className="h-4 w-4 mr-2" />
                            Ver Detalhes
                            <DropdownMenuItem onClick={() => openPasswordDialog(user.id)}>
                              <Key className="h-4 w-4 mr-2" />
                              Alterar Senha
                            </DropdownMenuItem>

                            <DropdownMenuItem onClick={() => window.dispatchEvent(new CustomEvent('openUserClone', { detail: { targetUserId: user.id } }))}>
                              <Copy className="h-4 w-4 mr-2" />
                              Clonar Usuário
                            </DropdownMenuItem>
                          </>
                        )}

                        <DropdownMenuSeparator />

                        {user.whatsapp && (
                          <DropdownMenuItem asChild>
                            <a
                              href={generateWhatsAppUrl(user.whatsapp, `Olá ${user.name}, como posso ajudar?`)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <MessageCircle className="h-4 w-4 mr-2" />
                              WhatsApp
                            </a>
                          </DropdownMenuItem>
                        )}

                        {user.phone && (
                          <DropdownMenuItem asChild>
                            <a href={`tel:${user.phone}`}>
                              <Phone className="h-4 w-4 mr-2" />
                              Ligar
                            </a>
                          </DropdownMenuItem>
                        )}

                        {user.instagram && (
                          <DropdownMenuItem asChild>
                            <a 
                              href={`https://instagram.com/${user.instagram}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                            >
                              <Instagram className="h-4 w-4 mr-2" />
                              Instagram
                            </a>
                          </DropdownMenuItem>
                        )}

                        {user.slug && (
                          <DropdownMenuItem asChild>
                            <a 
                              href={`/${user.slug}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Ver Vitrine
                            </a>
                          </DropdownMenuItem>
                        )}

                        {user.location_url && (
                          <DropdownMenuItem asChild>
                            <a 
                              href={user.location_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                            >
                              <MapPin className="h-4 w-4 mr-2" />
                              Localização
                            </a>
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                          onClick={() => handleToggleBlock(user.id, user.is_blocked)}
                          disabled={actionLoading === user.id}
                          className={user.is_blocked ? 'text-green-600' : 'text-red-600'}
                        >
                          {user.is_blocked ? (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Desbloquear
                            </>
                          ) : (
                            <>
                              <Ban className="h-4 w-4 mr-2" />
                              Bloquear
                            </>
                          )}
                        </DropdownMenuItem>

                        {/* Only show delete for non-admin users or if current user is admin */}
                        {(user.role !== 'admin' || currentUserRole === 'admin') && (
                          <>
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem
                                  onSelect={(e) => e.preventDefault()}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja excluir o usuário "{user.name}"? 
                                    Esta ação não pode ser desfeita e todos os dados associados serão removidos.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteUser(user.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Excluir Usuário
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Password Change Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar Senha do Usuário</DialogTitle>
            <DialogDescription>
              Digite a nova senha para o usuário selecionado
            </DialogDescription>
          </DialogHeader>

          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(handlePasswordChange)} className="space-y-4">
              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nova Senha</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          type={showPassword ? "text" : "password"} 
                          placeholder="Digite a nova senha"
                          {...field} 
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={passwordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar Nova Senha</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          type={showConfirmPassword ? "text" : "password"} 
                          placeholder="Confirme a nova senha"
                          {...field} 
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowPasswordDialog(false);
                    passwordForm.reset();
                    setSelectedUserId(null);
                    setShowPassword(false);
                    setShowConfirmPassword(false);
                  }}
                  disabled={changingPassword}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={changingPassword}>
                  {changingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Alterar Senha
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}