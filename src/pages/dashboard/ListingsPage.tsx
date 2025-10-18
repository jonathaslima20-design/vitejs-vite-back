import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useProductListManagement } from '@/hooks/useProductListManagement';
import { BulkActionsPanel } from '@/components/dashboard/BulkActionsPanel';
import { ListingsHeader } from '@/components/dashboard/ListingsHeader';
import { ListingsFilters } from '@/components/dashboard/ListingsFilters';
import { ListingsStatusBar } from '@/components/dashboard/ListingsStatusBar';
import { ProductGrid } from '@/components/dashboard/ProductGrid';
import { EmptyProductsState } from '@/components/dashboard/EmptyProductsState';

export default function ListingsPage() {
  const { user } = useAuth();
  
  const {
    products,
    filteredProducts,
    loading,
    searchQuery,
    statusFilter,
    categoryFilter,
    availableCategories,
    updatingProductId,
    reordering,
    isReorderModeActive,
    selectedProducts,
    bulkActionLoading,
    canReorder,
    allSelected,
    someSelected,
    setSearchQuery,
    setStatusFilter,
    setCategoryFilter,
    setIsReorderModeActive,
    toggleProductVisibility,
    handleSelectProduct,
    handleSelectAll,
    handleBulkVisibilityToggle,
    handleBulkCategoryChange,
    handleBulkBrandChange,
    handleBulkImageCompression,
    handleBulkDelete,
    handleDragEnd,
  } = useProductListManagement({ userId: user?.id });

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('todos');
    setCategoryFilter('todas');
  };

  const handleToggleReorderMode = () => {
    setIsReorderModeActive(!isReorderModeActive);
  };

  const handleSaveOrder = () => {
    setIsReorderModeActive(false);
  };

  const handleCancelReorder = () => {
    setIsReorderModeActive(false);
  };

  // Drag mode is only active when explicitly enabled AND reordering is possible
  const isDragMode = canReorder && isReorderModeActive;

  if (loading) {
    return (
      <div className="w-full py-4 md:py-8 px-2 md:px-4 lg:container lg:mx-auto">
        <div className="flex justify-between items-center mb-4 md:mb-6 px-2">
          <h1 className="text-2xl md:text-3xl font-bold">Meus Produtos</h1>
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Carregando...
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-4 px-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <Card key={n} className="animate-pulse">
              <CardContent className="p-2 md:p-3">
                <div className="aspect-square bg-white rounded-lg border border-gray-200 shadow-sm mb-3" />
                <div className="h-3 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full py-4 md:py-8 px-2 md:px-4 lg:container lg:mx-auto">
      <ListingsHeader
        canReorder={canReorder}
        isReorderModeActive={isReorderModeActive}
        reordering={reordering}
        allSelected={allSelected}
        filteredProductsLength={filteredProducts.length}
        onToggleReorderMode={handleToggleReorderMode}
        onSelectAll={handleSelectAll}
      />

      {/* Bulk Actions Panel */}
      <BulkActionsPanel
        selectedCount={selectedProducts.size}
        onClearSelection={() => setSelectedProducts(new Set())}
        onBulkVisibilityToggle={handleBulkVisibilityToggle}
        onBulkCategoryChange={handleBulkCategoryChange}
        onBulkBrandChange={handleBulkBrandChange}
        onBulkDelete={handleBulkDelete}
        onBulkImageCompression={handleBulkImageCompression}
        loading={bulkActionLoading}
        userId={user?.id}
      />

      <ListingsFilters
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        categoryFilter={categoryFilter}
        availableCategories={availableCategories}
        onSearchChange={setSearchQuery}
        onStatusChange={setStatusFilter}
        onCategoryChange={setCategoryFilter}
      />

      <ListingsStatusBar
        filteredProductsLength={filteredProducts.length}
        totalProductsLength={products.length}
        categoryFilter={categoryFilter}
        allSelected={allSelected}
        selectedProductsSize={selectedProducts.size}
        isDragMode={isDragMode}
        canReorder={canReorder}
        isReorderModeActive={isReorderModeActive}
        onSelectAll={handleSelectAll}
      />

      {filteredProducts.length === 0 ? (
        <EmptyProductsState
          hasProducts={products.length > 0}
          onClearFilters={handleClearFilters}
        />
      ) : (
        <ProductGrid
          products={filteredProducts}
          isDragMode={isDragMode}
          reordering={reordering}
          bulkActionLoading={bulkActionLoading}
          selectedProducts={selectedProducts}
          updatingProductId={updatingProductId}
          user={user}
          onSelectProduct={handleSelectProduct}
          onToggleVisibility={toggleProductVisibility}
          onDragEnd={handleDragEnd}
          onSaveOrder={handleSaveOrder}
          onCancelReorder={handleCancelReorder}
        />
      )}
    </div>
  );
}