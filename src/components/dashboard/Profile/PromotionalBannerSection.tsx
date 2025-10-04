import { useState } from 'react';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormLabel, FormDescription } from '@/components/ui/form';
import { supabase } from '@/lib/supabase';
import { ImageCropperBanner } from '@/components/ui/image-cropper-banner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PromotionalBannerSectionProps {
  user: any;
  previewBanner: { desktop: string | null; mobile: string | null };
  setPreviewBanner: (banner: { desktop: string | null; mobile: string | null }) => void;
}

export function PromotionalBannerSection({ user, previewBanner, setPreviewBanner }: PromotionalBannerSectionProps) {
  const [loading, setLoading] = useState(false);
  const [bannerCropperImage, setBannerCropperImage] = useState<{
    image: string | null;
    type: 'desktop' | 'mobile' | null;
  }>({ image: null, type: null });

  const handleBannerSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'desktop' | 'mobile'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 5MB.');
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Formato inválido. Use JPG, PNG ou WebP.');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setBannerCropperImage({ image: previewUrl, type });
  };

  const handleBannerCropComplete = async (croppedBlob: Blob) => {
    try {
      setLoading(true);

      const type = bannerCropperImage.type;
      if (!type) return;

      const fileName = `${user?.id}-promotional-banner-${type}-${Math.random()}.jpg`;
      const filePath = `promotional-banners/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('public')
        .upload(filePath, croppedBlob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('public')
        .getPublicUrl(filePath);

      const updateData = type === 'desktop'
        ? { promotional_banner_url_desktop: publicUrl }
        : { promotional_banner_url_mobile: publicUrl };

      const { error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', user?.id);

      if (updateError) throw updateError;

      setPreviewBanner(prev => ({
        ...prev,
        [type]: publicUrl
      }));

      toast.success(`Banner ${type === 'desktop' ? 'desktop' : 'mobile'} atualizado com sucesso`);
    } catch (error) {
      console.error('Error updating promotional banner:', error);
      toast.error('Erro ao atualizar banner promocional');
    } finally {
      setLoading(false);
      setBannerCropperImage({ image: null, type: null });
    }
  };

  const handleRemoveBanner = async (type: 'desktop' | 'mobile') => {
    try {
      setLoading(true);

      const updateData = type === 'desktop'
        ? { promotional_banner_url_desktop: null }
        : { promotional_banner_url_mobile: null };

      const { error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', user?.id);

      if (updateError) throw updateError;

      setPreviewBanner(prev => ({
        ...prev,
        [type]: null
      }));

      toast.success(`Banner ${type === 'desktop' ? 'desktop' : 'mobile'} removido com sucesso`);
    } catch (error) {
      console.error('Error removing promotional banner:', error);
      toast.error('Erro ao remover banner promocional');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Desktop Banner */}
      <div className="space-y-4">
        <FormLabel>Banner Promocional - Desktop</FormLabel>
        <div className="relative w-full h-[200px] overflow-hidden rounded-lg border bg-muted">
          {previewBanner.desktop ? (
            <img
              src={previewBanner.desktop}
              alt="Banner promocional desktop"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Nenhum banner desktop configurado
              </p>
            </div>
          )}
          <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
            <label className="flex h-full items-center justify-center cursor-pointer">
              <Input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => handleBannerSelect(e, 'desktop')}
              />
              <Upload className="h-6 w-6 text-white" />
            </label>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => document.querySelector('input[type="file"]')?.click()}
            disabled={loading}
          >
            <Upload className="h-4 w-4 mr-2" />
            {previewBanner.desktop ? 'Alterar Banner Desktop' : 'Adicionar Banner Desktop'}
          </Button>
          
          {previewBanner.desktop && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => handleRemoveBanner('desktop')}
              disabled={loading}
            >
              Remover Banner Desktop
            </Button>
          )}
        </div>
        
        <FormDescription>
          Recomendado: 1530px x 200px. Máximo 5MB.
          O banner será exibido no topo da sua vitrine pública em dispositivos desktop.
        </FormDescription>
      </div>

      {/* Mobile Banner */}
      <div className="space-y-4">
        <FormLabel>Banner Promocional - Mobile</FormLabel>
        <div className="relative w-full h-[200px] overflow-hidden rounded-lg border bg-muted">
          {previewBanner.mobile ? (
            <img
              src={previewBanner.mobile}
              alt="Banner promocional mobile"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Nenhum banner mobile configurado
              </p>
            </div>
          )}
          <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
            <label className="flex h-full items-center justify-center cursor-pointer">
              <Input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => handleBannerSelect(e, 'mobile')}
              />
              <Upload className="h-6 w-6 text-white" />
            </label>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => document.querySelectorAll('input[type="file"]')[1]?.click()}
            disabled={loading}
          >
            <Upload className="h-4 w-4 mr-2" />
            {previewBanner.mobile ? 'Alterar Banner Mobile' : 'Adicionar Banner Mobile'}
          </Button>
          
          {previewBanner.mobile && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => handleRemoveBanner('mobile')}
              disabled={loading}
            >
              Remover Banner Mobile
            </Button>
          )}
        </div>
        
        <FormDescription>
          Recomendado: 960px x 200px. Máximo 5MB.
          O banner será exibido no topo da sua vitrine pública em dispositivos móveis.
        </FormDescription>
      </div>

      {bannerCropperImage.image && bannerCropperImage.type && (
        <Dialog 
          open={!!bannerCropperImage.image} 
          onOpenChange={() => setBannerCropperImage({ image: null, type: null })}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Recortar Banner Promocional</DialogTitle>
              <DialogDescription>
                Ajuste a área de recorte do banner promocional para {bannerCropperImage.type === 'desktop' ? 'desktop (1530x200)' : 'mobile (960x200)'}
              </DialogDescription>
            </DialogHeader>
            <ImageCropperBanner
              image={bannerCropperImage.image}
              onCrop={handleBannerCropComplete}
              onCancel={() => setBannerCropperImage({ image: null, type: null })}
              aspectRatio={bannerCropperImage.type === 'desktop' ? 1530/200 : 960/200}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}