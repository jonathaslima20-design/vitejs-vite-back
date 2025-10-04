import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StorefrontFiltersManager from '@/components/dashboard/StorefrontFiltersManager';
import CategoryDisplaySettings from '@/components/dashboard/CategoryDisplaySettings';
import TrackingSettingsContent from '@/components/dashboard/TrackingSettingsContent';
import { useAuth } from '@/contexts/AuthContext';

export function StorefrontSettings() {
  const [activeTab, setActiveTab] = useState('filters');
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="filters">Filtros</TabsTrigger>
          <TabsTrigger value="organization">Organização</TabsTrigger>
          <TabsTrigger value="tracking">Rastreamento</TabsTrigger>
        </TabsList>
        
        <TabsContent value="filters" className="mt-6">
          <StorefrontFiltersManager />
        </TabsContent>
        
        <TabsContent value="organization" className="mt-6">
          <CategoryDisplaySettings />
        </TabsContent>
        
        <TabsContent value="tracking" className="mt-6">
          <TrackingSettingsContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}