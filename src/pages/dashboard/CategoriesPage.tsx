import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ProductCategoriesManager from '@/components/dashboard/ProductCategoriesManager';
import { useAuth } from '@/contexts/AuthContext';

export default function CategoriesPage() {
  const { user } = useAuth();

  return (
    <div className="container max-w-4xl mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Categorias</CardTitle>
          <CardDescription>
            Gerencie as categorias dos seus itens
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProductCategoriesManager />
        </CardContent>
      </Card>
    </div>
  );
}