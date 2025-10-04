import { useState } from 'react';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormLabel, FormDescription } from '@/components/ui/form';
import { supabase } from '@/lib/supabase';
import { ImageCropperCover } from '@/components/ui/image-cropper-cover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CoverImageSectionProps {
  user: any;
  previewCover: { desktop: string | null; mobile: string | null };
  setPreviewCover: (cover: { desktop: string | null; mobile: string | null }) => void;
}

export function CoverImageSection({ user, previewCover, setPreviewCover }: CoverImageSectionProps) {
  const [loading, setLoading] = useState(false);
  const [coverCropperImage, setCoverCropperImage] = useState<{
    image: string | null;
    type: 'desktop' | 'mobile' | null;
  }>({ image: null, type: null });

  const handleCoverSelect = async (
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
    setCoverCropperImage({ image: previewUrl, type });
  };

  const handleCoverCropComplete = async (croppedBlob: Blob) => {
    try {
      setLoading(true);

      const type = coverCropperImage.type;
      if (!type) return;

      const fileName = `${user?.id}-cover-${type}-${Math.random()}.jpg`;
      const filePath = `covers/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('public')
        .upload(filePath, croppedBlob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('public')
        .getPublicUrl(filePath);

      const updateData = type === 'desktop'
        ? { cover_url_desktop: publicUrl }
        : { cover_url_mobile: publicUrl };

      const { error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', user?.id);

      if (updateError) throw updateError;

      setPreviewCover(prev => ({
        ...prev,
        [type]: publicUrl
      }));

      toast.success('Imagem de capa atualizada com sucesso');
    } catch (error) {
      console.error('Error updating cover:', error);
      toast.error('Erro ao atualizar imagem de capa');
    } finally {
      setLoading(false);
      setCoverCropperImage({ image: null, type: null });
    }
  };

  return (
    <>
      {/* Desktop Cover Image */}
      <div className="space-y-4">
        <FormLabel>Imagem de Capa - Desktop</FormLabel>
        <div className="relative aspect-[1530/465] overflow-hidden rounded-lg border bg-muted">
          {previewCover.desktop ? (
            <img
              src={previewCover.desktop}
              alt="Capa do perfil - Desktop"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Nenhuma imagem selecionada
              </p>
            </div>
          )}
          <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
            <label className="flex h-full items-center justify-center cursor-pointer">
              <Input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => handleCoverSelect(e, 'desktop')}
              />
              <Upload className="h-6 w-6 text-white" />
            </label>
          </div>
        </div>
        <FormDescription>
          Recomendado: 1530x465px. Máximo 5MB.
        </FormDescription>
      </div>

      {/* Mobile Cover Image */}
      <div className="space-y-4">
        <FormLabel>Imagem de Capa - Mobile</FormLabel>
        <div className="relative aspect-[960/860] overflow-hidden rounded-lg border bg-muted">
          {previewCover.mobile ? (
            <img
              src={previewCover.mobile}
              alt="Capa do perfil - Mobile"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Nenhuma imagem selecionada
              </p>
            </div>
          )}
          <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
            <label className="flex h-full items-center justify-center cursor-pointer">
              <Input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => handleCoverSelect(e, 'mobile')}
              />
              <Upload className="h-6 w-6 text-white" />
            </label>
          </div>
        </div>
        <FormDescription>
          Recomendado: 960x860px. Máximo 5MB.
        </FormDescription>
      </div>

      {coverCropperImage.image && coverCropperImage.type && (
        <Dialog 
          open={!!coverCropperImage.image} 
          onOpenChange={() => setCoverCropperImage({ image: null, type: null })}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Recortar Imagem de Capa</DialogTitle>
              <DialogDescription>
                Ajuste a área de recorte da imagem de capa
              </DialogDescription>
            </DialogHeader>
            <ImageCropperCover
              image={coverCropperImage.image}
              onCrop={handleCoverCropComplete}
              onCancel={() => setCoverCropperImage({ image: null, type: null })}
              aspectRatio={coverCropperImage.type === 'desktop' ? 1530/465 : 960/860}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}