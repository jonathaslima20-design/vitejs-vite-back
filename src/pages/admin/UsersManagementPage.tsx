import { useState, useEffect } from 'react';
import { Loader as Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useSubscriptionPlans } from '@/hooks/useSubscriptionPlans';
import type { User } from '@/types';
import { getErrorMessage } from '@/lib/errorMessages';
import { UserListControls } from '@/components/admin/UserListControls';
import { UserTableMinimal } from '@/components/admin/UserTableMinimal';
import { FloatingUserBulkActions } from '@/components/admin/FloatingUserBulkActions';
import { UserSummaryCards } from '@/components/admin/UserSummaryCards';
import { SimpleCopyProductsDialog } from '@/components/admin/SimpleCopyProductsDialog';
import { CloneUserDialog } from '@/components/admin/CloneUserDialog';

export default function UsersManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [blockedFilter, setBlockedFilter] = useState('todos');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [showSimpleCopyDialog, setShowSimpleCopyDialog] = useState(false);
  const [showCopyProductsDialog, setShowCopyProductsDialog] = useState(false);
  const [showCloneUserDialog, setShowCloneUserDialog] = useState(false);
  const [cloneTargetUserId, setCloneTargetUserId] = useState<string>('');
  const [copyTargetUserId, setCopyTargetUserId] = useState<string>('');
  const [userToCloneId, setUserToCloneId] = useState<string>('');
  const [showSelection, setShowSelection] = useState(false);
  const { user: currentUser } = useAuth();
  const { plans: subscriptionPlans } = useSubscriptionPlans();

  // Listener para abrir dialog de clonagem
  useEffect(() => {
    const handleOpenCloneUserDialog = (event: CustomEvent) => {
      const { targetUserId } = event.detail;
      if (targetUserId) {
        setUserToCloneId(targetUserId);
        setShowCloneUserDialog(true);
      }
    };

    const handleOpenUserClone = (event: CustomEvent) => {
      const { targetUserId } = event.detail;
      if (targetUserId) {
        setCloneTargetUserId(targetUserId);
        setShowSimpleCopyDialog(true);
      }
    };

    const handleOpenCopyProducts = (event: CustomEvent) => {
      const { targetUserId } = event.detail;
      if (targetUserId) {
        setCopyTargetUserId(targetUserId);
        setShowCopyProductsDialog(true);
      }
    };

    window.addEventListener('openCloneUserDialog', handleOpenCloneUserDialog as EventListener);
    window.addEventListener('openUserClone', handleOpenUserClone as EventListener);
    window.addEventListener('openCopyProducts', handleOpenCopyProducts as EventListener);
    return () => {
      window.removeEventListener('openCloneUserDialog', handleOpenCloneUserDialog as EventListener);
      window.removeEventListener('openUserClone', handleOpenUserClone as EventListener);
      window.removeEventListener('openCopyProducts', handleOpenCopyProducts as EventListener);
    };
  }, []);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchQuery, roleFilter, statusFilter, blockedFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('users')
        .select(`
          *,
          creator:created_by (
            name,
            email
          )
        `, { count: 'exact' });

      // Apply role-based filtering based on current user
      if (currentUser?.role === 'parceiro') {
        query = query.eq('created_by', currentUser.id);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = [...users];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const numericQuery = query.replace(/\D/g, '');

      filtered = filtered.filter(user => {
        // Search in name
        const matchesName = user.name?.toLowerCase().includes(query) || false;

        // Search in email
        const matchesEmail = user.email?.toLowerCase().includes(query) || false;

        // Search in slug
        const matchesSlug = user.slug?.toLowerCase().includes(query) || false;

        // Search in WhatsApp (numeric only)
        const matchesWhatsApp = numericQuery && user.whatsapp
          ? user.whatsapp.replace(/\D/g, '').includes(numericQuery)
          : false;

        // Search in phone (numeric only)
        const matchesPhone = numericQuery && user.phone
          ? user.phone.replace(/\D/g, '').includes(numericQuery)
          : false;

        // Search in Instagram
        const matchesInstagram = user.instagram?.toLowerCase().includes(query) || false;

        return matchesName || matchesEmail || matchesSlug || matchesWhatsApp || matchesPhone || matchesInstagram;
      });
    }

    // Role filter
    if (roleFilter !== 'todos') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    // Plan status filter
    if (statusFilter !== 'todos') {
      filtered = filtered.filter(user => user.plan_status === statusFilter);
    }

    // Blocked filter
    if (blockedFilter !== 'todos') {
      const isBlocked = blockedFilter === 'true';
      filtered = filtered.filter(user => user.is_blocked === isBlocked);
    }

    setFilteredUsers(filtered);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setRoleFilter('todos');
    setStatusFilter('todos');
    setBlockedFilter('todos');
  };

  const handleSelectUser = (userId: string, checked: boolean) => {
    setSelectedUsers(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(userId);
        setShowSelection(true);
      } else {
        newSet.delete(userId);
        if (newSet.size === 0) {
          setShowSelection(false);
        }
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(new Set(filteredUsers.map(user => user.id)));
      setShowSelection(true);
    } else {
      setSelectedUsers(new Set());
      setShowSelection(false);
    }
  };

  const handleToggleBlock = async (userId: string, currentBlocked: boolean) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_blocked: !currentBlocked })
        .eq('id', userId);

      if (error) throw error;

      setUsers(users.map(user =>
        user.id === userId ? { ...user, is_blocked: !currentBlocked } : user
      ));

      toast.success(
        !currentBlocked ? 'Usuário bloqueado com sucesso' : 'Usuário desbloqueado com sucesso'
      );
    } catch (error) {
      console.error('Error toggling user block status:', error);
      toast.error('Erro ao atualizar status do usuário');
    }
  };

  const handleBulkBlockUsers = async () => {
    try {
      setBulkActionLoading(true);
      const selectedIds = Array.from(selectedUsers);

      const { error } = await supabase
        .from('users')
        .update({ is_blocked: true })
        .in('id', selectedIds);

      if (error) throw error;

      toast.success(`${selectedIds.length} usuários bloqueados com sucesso`);
      setSelectedUsers(new Set());
      fetchUsers();
    } catch (error) {
      console.error('Error blocking users:', error);
      toast.error('Erro ao bloquear usuários');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkUnblockUsers = async () => {
    try {
      setBulkActionLoading(true);
      const selectedIds = Array.from(selectedUsers);

      const { error } = await supabase
        .from('users')
        .update({ is_blocked: false })
        .in('id', selectedIds);

      if (error) throw error;

      toast.success(`${selectedIds.length} usuários desbloqueados com sucesso`);
      setSelectedUsers(new Set());
      fetchUsers();
    } catch (error) {
      console.error('Error unblocking users:', error);
      toast.error('Erro ao desbloquear usuários');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkActivatePlan = async (planId: string) => {
    try {
      setBulkActionLoading(true);
      const selectedIds = Array.from(selectedUsers);
      const selectedPlan = subscriptionPlans.find(p => p.id === planId);
      
      if (!selectedPlan) {
        toast.error('Plano selecionado não encontrado');
        return;
      }

      // Calculate next payment date based on plan duration
      const startDate = new Date();
      const nextPaymentDate = new Date(startDate);
      
      switch (selectedPlan.duration) {
        case 'Trimestral':
          nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 3);
          break;
        case 'Semestral':
          nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 6);
          break;
        case 'Anual':
          nextPaymentDate.setFullYear(nextPaymentDate.getFullYear() + 1);
          break;
      }

      // Create subscriptions for selected users
      const subscriptionInserts = selectedIds.map(userId => ({
        user_id: userId,
        plan_name: selectedPlan.name,
        monthly_price: selectedPlan.price,
        status: 'active',
        payment_status: 'paid',
        start_date: startDate.toISOString().split('T')[0],
        next_payment_date: nextPaymentDate.toISOString().split('T')[0],
      }));

      const { error: subscriptionError } = await supabase
        .from('subscriptions')
        .upsert(subscriptionInserts, {
          onConflict: 'user_id'
        });

      if (subscriptionError) throw subscriptionError;

      // Update user plan status
      const { error: userError } = await supabase
        .from('users')
        .update({ plan_status: 'active' })
        .in('id', selectedIds);

      if (userError) throw userError;

      toast.success(`Plano ativado para ${selectedIds.length} usuários`);
      setSelectedUsers(new Set());
      fetchUsers();
    } catch (error) {
      console.error('Error activating plans:', error);
      toast.error('Erro ao ativar planos');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkChangeRole = async (newRole: string) => {
    try {
      setBulkActionLoading(true);
      const selectedIds = Array.from(selectedUsers);

      const { error } = await supabase
        .from('users')
        .update({ role: newRole })
        .in('id', selectedIds);

      if (error) throw error;

      toast.success(`Função alterada para ${selectedIds.length} usuários`);
      setSelectedUsers(new Set());
      fetchUsers();
    } catch (error) {
      console.error('Error changing user roles:', error);
      toast.error('Erro ao alterar função dos usuários');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      // Use the edge function for proper user deletion
      const { error } = await supabase.functions.invoke('delete-user', {
        method: 'DELETE',
        body: { userId }
      });

      if (error) throw error;

      setUsers(users.filter(user => user.id !== userId));
      toast.success('Usuário excluído com sucesso');
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error(getErrorMessage(error));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Summary Cards */}
      <UserSummaryCards users={users} />

      {/* Controls */}
      <UserListControls
        searchQuery={searchQuery}
        roleFilter={roleFilter}
        statusFilter={statusFilter}
        blockedFilter={blockedFilter}
        onSearchChange={setSearchQuery}
        onRoleFilterChange={setRoleFilter}
        onStatusFilterChange={setStatusFilter}
        onBlockedFilterChange={setBlockedFilter}
        onClearFilters={handleClearFilters}
        totalUsers={users.length}
        filteredUsers={filteredUsers.length}
      />

      {/* Users Table */}
      <UserTableMinimal
        users={filteredUsers}
        selectedUsers={selectedUsers}
        onSelectUser={handleSelectUser}
        onSelectAll={handleSelectAll}
        onToggleBlock={handleToggleBlock}
        onDeleteUser={handleDeleteUser}
        loading={loading}
        currentUserRole={currentUser?.role || ''}
        showSelection={showSelection}
      />

      {/* Floating Bulk Actions */}
      <FloatingUserBulkActions
        selectedCount={selectedUsers.size}
        selectedUsers={filteredUsers.filter(user => selectedUsers.has(user.id))}
        onClearSelection={() => {
          setSelectedUsers(new Set());
          setShowSelection(false);
        }}
        onBulkActivatePlan={handleBulkActivatePlan}
        onBulkBlockUsers={handleBulkBlockUsers}
        onBulkUnblockUsers={handleBulkUnblockUsers}
        onBulkChangeRole={handleBulkChangeRole}
        loading={bulkActionLoading}
        subscriptionPlans={subscriptionPlans}
        currentUserRole={currentUser?.role || ''}
      />

      {/* Clone User Dialog */}
      <CloneUserDialog
        open={showCloneUserDialog}
        onOpenChange={setShowCloneUserDialog}
        sourceUserId={userToCloneId}
        onSuccess={(newUserId) => {
          // Navigate to the new user's detail page
          window.location.href = `/admin/users/${newUserId}`;
        }}
      />

      {/* Clone User Dialog */}
      <SimpleCopyProductsDialog
        open={showSimpleCopyDialog}
        onOpenChange={setShowSimpleCopyDialog}
        defaultSourceUserId={cloneTargetUserId}
      />

      {/* Copy Products Dialog */}
      <SimpleCopyProductsDialog
        open={showCopyProductsDialog}
        onOpenChange={setShowCopyProductsDialog}
        defaultTargetUserId={copyTargetUserId}
      />
    </div>
  );
}