import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, 
  Ban, 
  Shield, 
  X, 
  Crown, 
  Loader2, 
  MoreHorizontal,
  Save,
  RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { SubscriptionPlan } from '@/types';

interface FloatingUserBulkActionsProps {
  selectedCount: number;
  selectedUsers: any[];
  onClearSelection: () => void;
  onBulkActivatePlan: (planId: string) => Promise<void>;
  onBulkBlockUsers: () => Promise<void>;
  onBulkUnblockUsers: () => Promise<void>;
  onBulkChangeRole: (newRole: string) => Promise<void>;
  loading: boolean;
  subscriptionPlans: SubscriptionPlan[];
  currentUserRole: string;
}

export function FloatingUserBulkActions({
  selectedCount,
  selectedUsers,
  onClearSelection,
  onBulkActivatePlan,
  onBulkBlockUsers,
  onBulkUnblockUsers,
  onBulkChangeRole,
  loading,
  subscriptionPlans,
  currentUserRole
}: FloatingUserBulkActionsProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);

  if (selectedCount === 0) return null;

  const blockedCount = selectedUsers.filter(user => user.is_blocked).length;
  const unblockedCount = selectedCount - blockedCount;
  const inactiveCount = selectedUsers.filter(user => user.plan_status !== 'active').length;

  const handleActivatePlan = async () => {
    if (!selectedPlanId) return;
    
    await onBulkActivatePlan(selectedPlanId);
    setSelectedPlanId('');
    setShowPlanDialog(false);
  };

  const handleChangeRole = async () => {
    if (!selectedRole) return;
    
    await onBulkChangeRole(selectedRole);
    setSelectedRole('');
    setShowRoleDialog(false);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        transition={{ duration: 0.3 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
      >
        <div className="bg-background/95 backdrop-blur-sm border rounded-xl shadow-xl p-4 min-w-[400px]">
          <div className="flex items-center justify-between gap-4">
            {/* Selection Info */}
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                {selectedCount} usuário{selectedCount > 1 ? 's' : ''} selecionado{selectedCount > 1 ? 's' : ''}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearSelection}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              {/* Block/Unblock Actions */}
              {unblockedCount > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={loading}
                      className="flex items-center gap-2"
                    >
                      <Ban className="h-4 w-4" />
                      Bloquear ({unblockedCount})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Bloquear Usuários</AlertDialogTitle>
                      <AlertDialogDescription>
                        Você está prestes a bloquear {unblockedCount} usuário{unblockedCount > 1 ? 's' : ''}. 
                        Os usuários bloqueados não poderão acessar a plataforma.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={onBulkBlockUsers}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Bloquear {unblockedCount} Usuário{unblockedCount > 1 ? 's' : ''}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              {blockedCount > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={loading}
                      className="flex items-center gap-2"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Desbloquear ({blockedCount})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Desbloquear Usuários</AlertDialogTitle>
                      <AlertDialogDescription>
                        Você está prestes a desbloquear {blockedCount} usuário{blockedCount > 1 ? 's' : ''}. 
                        Os usuários poderão acessar a plataforma novamente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={onBulkUnblockUsers}>
                        Desbloquear {blockedCount} Usuário{blockedCount > 1 ? 's' : ''}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              {/* More Actions Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={loading}>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {/* Plan Activation */}
                  {inactiveCount > 0 && (
                    <DropdownMenuItem onClick={() => setShowPlanDialog(true)}>
                      <Crown className="h-4 w-4 mr-2" />
                      Ativar Plano ({inactiveCount})
                    </DropdownMenuItem>
                  )}

                  {/* Role Change - Only for admins */}
                  {currentUserRole === 'admin' && (
                    <DropdownMenuItem onClick={() => setShowRoleDialog(true)}>
                      <Shield className="h-4 w-4 mr-2" />
                      Alterar Função
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Plan Activation Dialog */}
        <Dialog open={showPlanDialog} onOpenChange={setShowPlanDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ativar Plano em Lote</DialogTitle>
              <DialogDescription>
                Selecione o plano que será ativado para os {inactiveCount} usuários com plano inativo.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Plano de Assinatura</Label>
                <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um plano" />
                  </SelectTrigger>
                  <SelectContent>
                    {subscriptionPlans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} - R$ {plan.price.toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPlanDialog(false);
                    setSelectedPlanId('');
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleActivatePlan}
                  disabled={!selectedPlanId || loading}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Ativar Plano
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Role Change Dialog */}
        <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Alterar Função em Lote</DialogTitle>
              <DialogDescription>
                Selecione a nova função para os {selectedCount} usuários selecionados.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nova Função</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma função" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corretor">Vendedor</SelectItem>
                    <SelectItem value="parceiro">Parceiro</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRoleDialog(false);
                    setSelectedRole('');
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleChangeRole}
                  disabled={!selectedRole || loading}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Alterar Função
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>
    </AnimatePresence>
  );
}