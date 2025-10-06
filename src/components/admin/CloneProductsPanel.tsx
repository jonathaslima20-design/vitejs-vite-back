import { useState } from 'react';
import { Copy, Zap, Settings, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EnhancedCloneDialog } from './EnhancedCloneDialog';
import { QuickCloneDialog } from './QuickCloneDialog';
import { PublicCloneDialog } from './PublicCloneDialog';

interface CloneProductsPanelProps {
  targetUserId?: string;
  sourceUserId?: string;
  className?: string;
}

export function CloneProductsPanel({ 
  targetUserId, 
  sourceUserId, 
  className 
}: CloneProductsPanelProps) {
  const [showEnhancedDialog, setShowEnhancedDialog] = useState(false);
  const [showQuickDialog, setShowQuickDialog] = useState(false);
  const [showPublicDialog, setShowPublicDialog] = useState(false);

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Sistema de Clonagem
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Quick Clone */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-blue-500" />
                <h4 className="font-medium">Clonagem Rápida</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Copia produtos e categorias sem imagens. Ideal para testes rápidos.
              </p>
              <div className="flex gap-2">
                <Badge variant="secondary" className="text-xs">~30s</Badge>
                <Badge variant="outline" className="text-xs">Sem imagens</Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowQuickDialog(true)}
                className="w-full"
              >
                <Zap className="h-4 w-4 mr-2" />
                Clonagem Rápida
              </Button>
            </div>

            {/* Enhanced Clone */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-green-500" />
                <h4 className="font-medium">Clonagem Avançada</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Controle total sobre o processo. Inclui imagens e configurações avançadas.
              </p>
              <div className="flex gap-2">
                <Badge variant="secondary" className="text-xs">~5-15min</Badge>
                <Badge variant="outline" className="text-xs">Com imagens</Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEnhancedDialog(true)}
                className="w-full"
              >
                <Settings className="h-4 w-4 mr-2" />
                Clonagem Avançada
              </Button>
            </div>

            {/* Public API Clone */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-500" />
                <h4 className="font-medium">API Pública</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Usa API Key para clonagem externa. Não requer autenticação JWT.
              </p>
              <div className="flex gap-2">
                <Badge variant="secondary" className="text-xs">API Key</Badge>
                <Badge variant="outline" className="text-xs">Externa</Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPublicDialog(true)}
                className="w-full"
              >
                <Users className="h-4 w-4 mr-2" />
                API Pública
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <EnhancedCloneDialog
        open={showEnhancedDialog}
        onOpenChange={setShowEnhancedDialog}
        defaultTargetUserId={targetUserId}
        defaultSourceUserId={sourceUserId}
      />

      <QuickCloneDialog
        open={showQuickDialog}
        onOpenChange={setShowQuickDialog}
        defaultTargetUserId={targetUserId}
        defaultSourceUserId={sourceUserId}
      />

      <PublicCloneDialog
        open={showPublicDialog}
        onOpenChange={setShowPublicDialog}
        defaultTargetUserId={targetUserId}
        defaultSourceUserId={sourceUserId}
      />
    </div>
  );
}