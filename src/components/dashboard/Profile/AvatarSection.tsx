import { useState } from 'react';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { getInitials } from '@/lib/utils';
import { ImageCropper } from '@/components/ui/image-cropper';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AvatarSectionProps {
  user: any;
  previewImage: string | null;
  setPreviewImage: (url: string | null) => void;
}

export function AvatarSection({ user, previewImage, setPreviewImage }: AvatarSectionProps) {
  const [loading, setLoading] = useState(false);
  const [cropperImage, setCropperImage] = useState<string | null>(null);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    setCropperImage(previewUrl);
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    try {
      setLoading(true);

      const fileName = `${user?.id}-avatar-${Math.random()}.jpg`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('public')
        .upload(filePath, croppedBlob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('public')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', user?.id);

      if (updateError) throw updateError;

      setPreviewImage(publicUrl);
      toast.success('Foto de perfil atualizada com sucesso');
    } catch (error) {
      console.error('Error updating avatar:', error);
      toast.error('Erro ao atualizar foto de perfil');
    } finally {
      setLoading(false);
      setCropperImage(null);
    }
  };

  return (
    <>
      <div className="flex flex-col items-center space-y-4">
        <Avatar className="h-32 w-32">
          <AvatarImage src={previewImage || undefined} />
          <AvatarFallback>
            {getInitials(user?.name || '')}
          </AvatarFallback>
        </Avatar>
        <Button 
          variant="outline" 
          onClick={() => document.getElementById('avatar-input')?.click()}
          disabled={loading}
        >
          <Upload className="h-4 w-4 mr-2" />
          Alterar foto
        </Button>
        <Input
          id="avatar-input"
          type="file"
          className="hidden"
          accept="image/*"
          onChange={handleImageSelect}
        />
      </div>

      {cropperImage && (
        <Dialog open={!!cropperImage} onOpenChange={() => setCropperImage(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Recortar Imagem</DialogTitle>
              <DialogDescription>
                Ajuste a área de recorte da imagem
              </DialogDescription>
            </DialogHeader>
            <ImageCropper
              image={cropperImage}
              onCrop={handleCropComplete}
              onCancel={() => setCropperImage(null)}
              aspectRatio={1}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}