import { Link } from 'react-router-dom';
import { Eye, CreditCard as Edit, Trash2, Ban, CircleCheck as CheckCircle, Copy, ExternalLink, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Card, CardContent } from '@/components/ui/card';
import { getInitials, formatPhone, formatWhatsAppForDisplay } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import PlanStatusBadge from '@/components/subscription/PlanStatusBadge';
import type { User } from '@/types';

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
  const allSelected = users.length > 0 && users.every(user => selectedUsers.has(user.id));
  const someSelected = selectedUsers.size > 0 && !allSelected;

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-primary">Administrador</Badge>;
      case 'parceiro':
        return <Badge className="bg-blue-500">Parceiro</Badge>;
      case 'corretor':
        return <Badge variant="secondary">Vendedor</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  const handleCloneUser = (userId: string) => {
    // Dispatch custom event to open clone dialog
    const event = new CustomEvent('openUserClone', {
      detail: { targetUserId: userId }
    });
    window.dispatchEvent(event);
  };

  const handleCopyProducts = (userId: string) => {
    // Dispatch custom event to open copy products dialog
    const event = new CustomEvent('openCopyProducts', {
      detail: { targetUserId: userId }
    });
    window.dispatchEvent(event);
  };
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center min-h-[200px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (users.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <h3 className="text-lg font-semibold mb-2">Nenhum usuário encontrado</h3>
          <p className="text-muted-foreground">
            Não há usuários que correspondam aos filtros selecionados.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="rounded-md border">
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
                <TableHead>Plano</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} className={selectedUsers.has(user.id) ? "bg-muted/50" : ""}>
                  <TableCell>
                    <Checkbox
                      checked={selectedUsers.has(user.id)}
                      onCheckedChange={(checked) => onSelectUser(user.id, checked as boolean)}
                      aria-label={`Selecionar ${user.name}`}
                    />
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatar_url} alt={user.name} />
                        <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{user.name}</div>
                        <div className="text-sm text-muted-foreground truncate">{user.email}</div>
                        {user.slug && (
                          <div className="text-xs text-muted-foreground">
                            /{user.slug}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    {getRoleBadge(user.role)}
                  </TableCell>
                  
                  <TableCell>
                    <PlanStatusBadge status={user.plan_status} />
                  </TableCell>
                  
                  <TableCell>
                    <div className="space-y-1">
                      {user.phone && (
                        <div className="text-xs text-muted-foreground">
                          📞 {formatPhone(user.phone)}
                        </div>
                      )}
                      {user.whatsapp && (
                        <div className="text-xs text-muted-foreground">
                          💬 {formatWhatsAppForDisplay(user.whatsapp)}
                        </div>
                      )}
                      {user.instagram && (
                        <div className="text-xs text-muted-foreground">
                          📷 @{user.instagram}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    {user.is_blocked ? (
                      <Badge variant="destructive">Bloqueado</Badge>
                    ) : (
                      <Badge className="bg-green-500">Ativo</Badge>
                    )}
                  </TableCell>
                  
                  <TableCell>
                    <div className="text-sm">
                      {format(new Date(user.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </div>
                  </TableCell>
                  
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {/* View Profile */}
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <Link to={`/admin/users/${user.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>

                      {/* View Storefront */}
                      {user.slug && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <a 
                            href={`/${user.slug}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}

                      {/* Copy Products - Only for admins */}
                      {currentUserRole === 'admin' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyProducts(user.id)}
                          title="Copiar produtos para outro usuário"
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                        </Button>
                      )}
                      {/* Clone User - Only for admins */}
                      {currentUserRole === 'admin' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCloneUser(user.id)}
                          title="Clonar usuário completo"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}

                      {/* Block/Unblock */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onToggleBlock(user.id, user.is_blocked)}
                        className={user.is_blocked ? "text-green-600 hover:text-green-700" : "text-red-600 hover:text-red-700"}
                      >
                        {user.is_blocked ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <Ban className="h-4 w-4" />
                        )}
                      </Button>

                      {/* Delete User - Only for admins and only non-admin users */}
                      {currentUserRole === 'admin' && user.role !== 'admin' && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir o usuário "{user.name}"? 
                                Esta ação não pode ser desfeita e todos os dados do usuário serão removidos.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => onDeleteUser(user.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}