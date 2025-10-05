import { Search, Filter, Users, Shield, Ban } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface UserFiltersProps {
  searchQuery: string;
  roleFilter: string;
  statusFilter: string;
  blockedFilter: string;
  onSearchChange: (query: string) => void;
  onRoleFilterChange: (role: string) => void;
  onStatusFilterChange: (status: string) => void;
  onBlockedFilterChange: (blocked: string) => void;
  onClearFilters: () => void;
  totalUsers: number;
  filteredUsers: number;
}

export function UserFilters({
  searchQuery,
  roleFilter,
  statusFilter,
  blockedFilter,
  onSearchChange,
  onRoleFilterChange,
  onStatusFilterChange,
  onBlockedFilterChange,
  onClearFilters,
  totalUsers,
  filteredUsers
}: UserFiltersProps) {
  const hasActiveFilters = searchQuery || roleFilter !== 'todos' || statusFilter !== 'todos' || blockedFilter !== 'todos';

  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email, slug, telefone, WhatsApp ou Instagram..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 h-10"
            />
          </div>

          {/* Filters Row */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex flex-wrap gap-3 flex-1">
              {/* Role Filter */}
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <Select value={roleFilter} onValueChange={onRoleFilterChange}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue placeholder="Função" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas as funções</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="parceiro">Parceiro</SelectItem>
                    <SelectItem value="corretor">Vendedor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Plan Status Filter */}
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <Select value={statusFilter} onValueChange={onStatusFilterChange}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue placeholder="Status do Plano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os status</SelectItem>
                    <SelectItem value="active">Plano Ativo</SelectItem>
                    <SelectItem value="inactive">Plano Inativo</SelectItem>
                    <SelectItem value="suspended">Plano Suspenso</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Blocked Filter */}
              <div className="flex items-center gap-2">
                <Ban className="h-4 w-4 text-muted-foreground" />
                <Select value={blockedFilter} onValueChange={onBlockedFilterChange}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue placeholder="Status de Acesso" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="false">Desbloqueados</SelectItem>
                    <SelectItem value="true">Bloqueados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={onClearFilters}
                className="h-9"
              >
                <Filter className="h-4 w-4 mr-2" />
                Limpar Filtros
              </Button>
            )}
          </div>

          {/* Results Summary */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>
                Exibindo {filteredUsers} de {totalUsers} usuários
              </span>
              {hasActiveFilters && (
                <Badge variant="secondary" className="text-xs">
                  Filtros ativos
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}