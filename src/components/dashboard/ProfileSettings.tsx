import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Loader2, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@radix-ui/react-collapsible';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { cleanWhatsAppNumber, formatWhatsAppForDisplay } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errorMessages';

// Import refactored components
import { AvatarSection } from './Profile/AvatarSection';
import { CoverImageSection } from './Profile/CoverImageSection';
import { BasicInfoForm } from './Profile/BasicInfoForm';
import { PasswordChangeDialog } from './Profile/PasswordChangeDialog';
import { ThemeToggleSection } from './Profile/ThemeToggleSection';
import { PromotionalBannerSection } from './Profile/PromotionalBannerSection';

const formSchema = z.object({
  name: z.string().min(2, 'Nome muito curto'),
  email: z.string().email('Email inválido'),
  language: z.enum(['pt-BR', 'en-US', 'es-ES']),
  currency: z.enum(['BRL', 'USD', 'EUR', 'GBP']),
  phone: z.string().optional(),
  bio: z.string().optional(),
  whatsapp: z.string().optional(),
  instagram: z.string().optional(),
  location_url: z.string().url('URL inválida').optional().or(z.literal('')),
  slug: z.string().min(2, 'Link muito curto').max(50, 'Link muito longo')
    .regex(/^[a-z0-9-]+$/, 'Use apenas letras minúsculas, números e hífens'),
});

export function ProfileSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewCover, setPreviewCover] = useState<{ desktop: string | null; mobile: string | null }>({
    desktop: null,
    mobile: null
  });
  const [previewBanner, setPreviewBanner] = useState<{ desktop: string | null; mobile: string | null }>({
    desktop: null,
    mobile: null
  });
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [coverImagesOpen, setCoverImagesOpen] = useState(false);
  const [promotionalBannerOpen, setPromotionalBannerOpen] = useState(false);
  const { user, updateUser } = useAuth();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      language: 'pt-BR',
      currency: 'BRL',
      phone: '',
      bio: '',
      whatsapp: '',
      instagram: '',
      location_url: '',
      slug: '',
    },
  });

  useEffect(() => {
    if (user) {
      setPreviewImage(user.avatar_url || null);
      setPreviewCover({
        desktop: user.cover_url_desktop || null,
        mobile: user.cover_url_mobile || null
      });
      setPreviewBanner({
        desktop: user.promotional_banner_url_desktop || null,
        mobile: user.promotional_banner_url_mobile || null
      });
      setIsDarkTheme(user.theme === 'dark');
      
      // Reset form with properly formatted values
      form.reset({
        name: user.name || '',
        email: user.email || '',
        language: user.language || 'pt-BR',
        currency: user.currency || 'BRL',
        phone: user.phone ? user.phone.replace(/\D/g, '') : '', // Store only digits for editing
        bio: user.bio || '',
        whatsapp: user.whatsapp ? user.whatsapp.replace(/\D/g, '') : '', // Store only digits for editing
        instagram: user.instagram || '',
        location_url: user.location_url || '',
        slug: user.slug || '',
      });
      
      setLoading(false);
    }
  }, [user, form]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    form.setValue('name', name);
    
    if (!form.getValues('slug')) {
      const slug = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      form.setValue('slug', slug);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setSaving(true);

      // Check if email has changed
      const emailChanged = values.email !== user?.email;

      // Format phone number for storage (display format)
      let formattedPhone = null;
      if (values.phone) {
        const numbers = values.phone.replace(/\D/g, '');
        if (numbers.length === 11) {
          formattedPhone = `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
        } else if (numbers.length === 10) {
          formattedPhone = `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
        } else if (numbers.length > 0) {
          formattedPhone = numbers; // Store as digits if doesn't match pattern
        }
      }

      // Clean and validate WhatsApp number
      let cleanedWhatsApp = null;
      if (values.whatsapp) {
        // Store WhatsApp number as clean digits without automatic 9 addition
        cleanedWhatsApp = values.whatsapp.replace(/\D/g, '');
        console.log('WhatsApp processing:', {
          input: values.whatsapp,
          cleaned: cleanedWhatsApp
        });
      }

      // Format Instagram handle
      let formattedInstagram = null;
      if (values.instagram) {
        formattedInstagram = values.instagram.replace(/^@/, '');
      }

      // Check if slug is unique
      if (values.slug !== user?.slug) {
        const { data: existingUser, error: checkError } = await supabase
          .from('users')
          .select('id')
          .eq('slug', values.slug)
          .maybeSingle();

        if (checkError) {
          throw checkError;
        }

        if (existingUser) {
          throw new Error('Este link já está sendo usado por outro usuário');
        }
      }

      // Check if new email is already in use (only if email changed)
      if (emailChanged) {
        const { data: existingEmailUser, error: emailCheckError } = await supabase
          .from('users')
          .select('id')
          .eq('email', values.email)
          .neq('id', user?.id)
          .maybeSingle();

        if (emailCheckError && emailCheckError.code !== 'PGRST116') {
          throw emailCheckError;
        }

        if (existingEmailUser) {
          throw new Error('Este email já está sendo usado por outro usuário');
        }
      }
      const updateData = {
        name: values.name,
        email: values.email,
        language: values.language,
        currency: values.currency,
        phone: formattedPhone,
        bio: values.bio,
        whatsapp: cleanedWhatsApp,
        instagram: formattedInstagram,
        location_url: values.location_url || null,
        slug: values.slug,
      };

      console.log('Updating user with data:', updateData);

      // If email changed, update in Supabase Auth first
      if (emailChanged) {
        try {
          // Update email in Supabase Auth - this will send a confirmation email
          const { error: authError } = await supabase.auth.updateUser({
            email: values.email,
            options: {
              emailRedirectTo: `${window.location.origin}/dashboard/settings`
            }
          });

          if (authError) {
            // Handle specific auth errors
            throw new Error(getErrorMessage(authError));
          }

          console.log('Email update initiated in Supabase Auth');
        } catch (authError: any) {
          console.error('Auth update error:', authError);
          throw authError; // Re-throw the error to be handled by the outer catch
        }
      }

      // Always update the database with the new email
      // The auth system will handle the confirmation process
      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', user?.id);

      if (error) throw error;

      // Update user in context and local storage
      await updateUser(updateData);

      if (emailChanged) {
        toast.success('Perfil atualizado com sucesso! Um email de confirmação foi enviado para o novo endereço. Clique no link do email para confirmar a alteração. Até lá, continue usando o email atual para fazer login.');
      } else {
        toast.success('Perfil atualizado com sucesso');
      }
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Erro ao atualizar perfil');
    } finally {
      setSaving(false);
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
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          {/* Avatar Section */}
          <AvatarSection 
            user={user}
            previewImage={previewImage}
            setPreviewImage={setPreviewImage}
          />

          <Separator className="my-6" />

          {/* Cover Images Section */}
          <Collapsible open={coverImagesOpen} onOpenChange={setCoverImagesOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between"
                type="button"
              >
                Imagens de Capa
                <ChevronDown className={`h-4 w-4 transition-transform ${coverImagesOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-6 mt-4">
              <CoverImageSection
                user={user}
                previewCover={previewCover}
                setPreviewCover={setPreviewCover}
              />
            </CollapsibleContent>
          </Collapsible>

          <Separator className="my-6" />

          {/* Promotional Banner Section */}
          <Collapsible open={promotionalBannerOpen} onOpenChange={setPromotionalBannerOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between"
                type="button"
              >
                Banner Promocional
                <ChevronDown className={`h-4 w-4 transition-transform ${promotionalBannerOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-6 mt-4">
              <PromotionalBannerSection
                user={user}
                previewBanner={previewBanner}
                setPreviewBanner={setPreviewBanner}
              />
            </CollapsibleContent>
          </Collapsible>

          <Separator className="my-6" />

          {/* Basic Information */}
          <BasicInfoForm
            form={form}
            user={user}
            onNameChange={handleNameChange}
          />

          <FormField
            control={form.control}
            name="bio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Biografia</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Separator className="my-6" />

          {/* Theme Toggle */}
          <ThemeToggleSection
            user={user}
            isDarkTheme={isDarkTheme}
            setIsDarkTheme={setIsDarkTheme}
          />

          <div className="flex justify-end space-x-4 mt-6">
            <PasswordChangeDialog
              user={user}
              open={showPasswordDialog}
              onOpenChange={setShowPasswordDialog}
            />
            
            <Button
              type="submit"
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Alterações
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}