import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { toast } from 'sonner';
import { Upload, X, Loader2, Trash2, Star, Crop, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { TagInput } from '@/components/ui/tag-input';
import { CustomSizeInput } from '@/components/ui/custom-size-input';
import { syncUserCategoriesWithStorefrontSettings } from '@/lib/utils';
import { validateAndSanitizeCategories, logCategoryOperation, sanitizeCategoryName } from '@/lib/categoryUtils';
import { CustomColorSelector } from '@/components/ui/custom-color-selector';
import { ApparelSizeSelector } from '@/components/ui/apparel-size-selector';
import { ShoeSizeSelector } from '@/components/ui/shoe-size-selector';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Switch } from '@/components/ui/switch';
import { DiscountPriceInput } from '@/components/ui/discount-price-input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ImageCropperProduct } from '@/components/ui/image-cropper-product';
import { supabase } from '@/lib/supabase';

const formSchema = z.object({
  title: z.string().min(1, 'Nome do produto é obrigatório'),
  categories: z.array(z.string()).min(1, 'Adicione pelo menos uma categoria'),
  brand: z.string().optional(),
  gender: z.enum(['masculino', 'feminino', 'unissex']).optional(),
  colors: z.array(z.string()).optional(),
  apparel_sizes: z.array(z.string()).optional(),
  shoe_sizes: z.array(z.string()).optional(),
  custom_sizes: z.array(z.string()).optional(),
  price: z.string().optional(),
  discounted_price: z.string().optional(),
  is_starting_price: z.boolean().default(false),
  short_description: z.string().max(60, 'Descrição breve muito longa (máx. 60 caracteres)').optional(),
  description: z.string().min(1, 'Descrição completa é obrigatória'),
  is_visible_on_storefront: z.boolean().default(true),
  external_checkout_url: z.string().url('URL inválida').optional().or(z.literal('')),
});

export default function EditProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<any[]>([]);
  const [featuredImageId, setFeaturedImageId] = useState<string | null>(null);
  const [newFeaturedImageIndex, setNewFeaturedImageIndex] = useState<number | null>(null);
  const [croppingNewImageIndex, setCroppingNewImageIndex] = useState<number | null>(null);
  const [croppingExistingImageId, setCroppingExistingImageId] = useState<string | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [productOwnerId, setProductOwnerId] = useState<string | null>(null);
  const [sizesOpen, setSizesOpen] = useState(false);
  const [colorsOpen, setColorsOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      categories: [],
      brand: '',
      gender: undefined,
      colors: [],
      apparel_sizes: [],
      shoe_sizes: [],
      price: '',
      discounted_price: '',
      is_starting_price: false,
      short_description: '',
      description: '',
      is_visible_on_storefront: true,
      external_checkout_url: '',
    },
  });

  useEffect(() => {
    loadProduct();
  }, [id]);

  const fetchCategories = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_product_categories')
        .select('id, name')
        .eq('user_id', userId)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error('Erro ao carregar categorias');
    }
  };

  const loadProduct = async () => {
    try {
      setIsLoading(true);

      const { data: product, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (productError) throw productError;

      // Store the product owner ID
      setProductOwnerId(product.user_id);

      // Check permissions
      const isOwner = product.user_id === user?.id;
      const isAdmin = user?.role === 'admin';
      
      let isPartnerAndCreator = false;
      if (user?.role === 'parceiro') {
        const { data: ownerUser, error: ownerError } = await supabase
          .from('users')
          .select('created_by')
          .eq('id', product.user_id)
          .single();
        
        if (!ownerError && ownerUser) {
          isPartnerAndCreator = ownerUser.created_by === user.id;
        }
      }

      if (!isOwner && !isAdmin && !isPartnerAndCreator) {
        toast.error('Você não tem permissão para editar este produto.');
        
        // Redirect based on user role
        if (user?.role === 'admin' || user?.role === 'parceiro') {
          navigate('/admin/users', { replace: true });
        } else {
          navigate('/dashboard/listings', { replace: true });
        }
        return;
      }

      // Load categories for the product owner
      await fetchCategories(product.user_id);

      // Parse sizes from database and distribute to apparel and shoe sizes
      const existingSizes = product.sizes || [];
      const apparelSizes: string[] = [];
      const shoeSizes: string[] = [];
      const customSizes: string[] = [];
      
      existingSizes.forEach((size: string) => {
        // Check if it's a shoe size (numeric between 33-48)
        const numericSize = parseInt(size);
        if (!isNaN(numericSize) && numericSize >= 17 && numericSize <= 43) {
          shoeSizes.push(size);
        } else if (['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG'].includes(size)) {
          // Standard apparel sizes
          apparelSizes.push(size);
        } else {
          // Custom sizes (anything that doesn't fit standard categories)
          customSizes.push(size);
        }
      });

      form.reset({
        title: product.title,
        categories: product.category || [],
        brand: product.brand || '',
        gender: product.gender || undefined,
        colors: product.colors || [],
        apparel_sizes: apparelSizes,
        shoe_sizes: shoeSizes,
        price: product.price ? product.price.toString() : '',
        discounted_price: product.discounted_price ? product.discounted_price.toString() : '',
        is_starting_price: product.is_starting_price || false,
        short_description: product.short_description || '',
        description: product.description || '',
        is_visible_on_storefront: product.is_visible_on_storefront ?? true,
        external_checkout_url: product.external_checkout_url || '',
      });

      const { data: images, error: imagesError } = await supabase
        .from('product_images')
        .select('*')
        .eq('product_id', id)
        .order('is_featured', { ascending: false });

      if (imagesError) throw imagesError;
      setExistingImages(images || []);

      // Set featured image ID
      const featuredImage = images?.find(img => img.is_featured);
      if (featuredImage) {
        setFeaturedImageId(featuredImage.id);
      }

    } catch (error) {
      console.error('Error loading product:', error);
      toast.error('Erro ao carregar produto');
      
      // Redirect based on user role
      if (user?.role === 'admin' || user?.role === 'parceiro') {
        navigate('/admin/users');
      } else {
        navigate('/dashboard/listings');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (existingImages.length + selectedImages.length + files.length > 10) {
      toast.error('Máximo de 10 fotos permitido');
      return;
    }
    
    const validFiles = files.filter(file => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`Arquivo ${file.name} excede o limite de 5MB`);
        return false;
      }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        toast.error(`Arquivo ${file.name} não é uma imagem válida`);
        return false;
      }
      return true;
    });

    if (validFiles.length > 0) {
      setSelectedImages(prev => [...prev, ...validFiles]);
      
      validFiles.forEach(file => {
        const url = URL.createObjectURL(file);
        setPreviewUrls(prev => [...prev, url]);
      });
    }
  };

  const removeNewImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    URL.revokeObjectURL(previewUrls[index]);
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
    
    if (newFeaturedImageIndex === index) {
      setNewFeaturedImageIndex(null);
    } else if (newFeaturedImageIndex !== null && index < newFeaturedImageIndex) {
      setNewFeaturedImageIndex(prev => prev! - 1);
    }

    // Update cropping image index if necessary
    if (croppingNewImageIndex === index) {
      setCroppingNewImageIndex(null);
    } else if (croppingNewImageIndex !== null && croppingNewImageIndex > index) {
      setCroppingNewImageIndex(croppingNewImageIndex - 1);
    }
  };

  const removeExistingImage = async (imageId: string) => {
    try {
      setIsLoading(true);
      
      const imageToDelete = existingImages.find(img => img.id === imageId);
      if (!imageToDelete) return;

      const { error: storageError } = await supabase.storage
        .from('public')
        .remove([`products/${imageToDelete.url.split('/').pop()}`]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('product_images')
        .delete()
        .eq('id', imageId);

      if (dbError) throw dbError;

      setExistingImages(prev => prev.filter(img => img.id !== imageId));
      
      // If this was the featured image, set the first remaining image as featured
      if (imageId === featuredImageId) {
        const remainingImages = existingImages.filter(img => img.id !== imageId);
        if (remainingImages.length > 0) {
          await setExistingImageAsFeatured(remainingImages[0].id);
        } else {
          setFeaturedImageId(null);
        }
      }

      toast.success('Imagem removida com sucesso');
    } catch (error) {
      toast.error('Erro ao remover imagem');
    } finally {
      setIsLoading(false);
    }
  };

  const setExistingImageAsFeatured = async (imageId: string) => {
    try {
      setIsLoading(true);

      // Update all images to not featured
      await supabase
        .from('product_images')
        .update({ is_featured: false })
        .eq('product_id', id);

      // Set the selected image as featured
      const { data: image, error: imageError } = await supabase
        .from('product_images')
        .update({ is_featured: true })
        .eq('id', imageId)
        .select()
        .single();

      if (imageError) throw imageError;

      // Update product's featured image URL
      const { error: productError } = await supabase
        .from('products')
        .update({ featured_image_url: image.url })
        .eq('id', id);

      if (productError) throw productError;

      setFeaturedImageId(imageId);
      setNewFeaturedImageIndex(null);

      // Update the existing images array
      setExistingImages(prev =>
        prev.map(img => ({
          ...img,
          is_featured: img.id === imageId
        }))
      );

    } catch (error) {
      toast.error('Erro ao definir imagem principal');
    } finally {
      setIsLoading(false);
    }
  };

  const setNewImageAsFeatured = (index: number) => {
    setNewFeaturedImageIndex(index);
    setFeaturedImageId(null);
  };

  const handleNewImageCropComplete = (croppedBlob: Blob) => {
    if (croppingNewImageIndex === null) return;

    // Create a new File from the cropped blob
    const croppedFile = new File([croppedBlob], `cropped-${Date.now()}.jpg`, {
      type: 'image/jpeg',
    });

    // Update the selected images array
    setSelectedImages(prev => prev.map((file, index) => 
      index === croppingNewImageIndex ? croppedFile : file
    ));

    // Update the preview URLs
    setPreviewUrls(prev => {
      const newUrls = [...prev];
      // Revoke the old URL
      URL.revokeObjectURL(newUrls[croppingNewImageIndex]);
      // Create new URL for cropped image
      newUrls[croppingNewImageIndex] = URL.createObjectURL(croppedFile);
      return newUrls;
    });

    // Reset cropping state
    setCroppingNewImageIndex(null);
  };

  const handleExistingImageCropComplete = async (croppedBlob: Blob) => {
    if (!croppingExistingImageId) return;

    try {
      setIsLoading(true);

      const existingImage = existingImages.find(img => img.id === croppingExistingImageId);
      if (!existingImage) return;

      // Upload the cropped image
      const fileName = `${id}-cropped-${Date.now()}.jpg`;
      const filePath = `products/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('public')
        .upload(filePath, croppedBlob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('public')
        .getPublicUrl(filePath);

      // Update the image URL in the database
      const { error: updateError } = await supabase
        .from('product_images')
        .update({ url: publicUrl })
        .eq('id', croppingExistingImageId);

      if (updateError) throw updateError;

      // If this is the featured image, update the product's featured image URL
      if (existingImage.is_featured) {
        const { error: productUpdateError } = await supabase
          .from('products')
          .update({ featured_image_url: publicUrl })
          .eq('id', id);

        if (productUpdateError) throw productUpdateError;
      }

      // Update local state
      setExistingImages(prev => prev.map(img => 
        img.id === croppingExistingImageId ? { ...img, url: publicUrl } : img
      ));

      // Delete the old image from storage
      const oldFileName = existingImage.url.split('/').pop();
      if (oldFileName) {
        await supabase.storage
          .from('public')
          .remove([`products/${oldFileName}`]);
      }

      toast.success('Imagem cortada com sucesso');
    } catch (error) {
      console.error('Error cropping existing image:', error);
      toast.error('Erro ao cortar imagem');
    } finally {
      setIsLoading(false);
      setCroppingExistingImageId(null);
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);

      // Delete all images from storage
      for (const image of existingImages) {
        await supabase.storage
          .from('public')
          .remove([`products/${image.url.split('/').pop()}`]);
      }

      // Delete the product
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Produto excluído com sucesso');
      
      // Redirect based on user role
      if (user?.role === 'admin' || user?.role === 'parceiro') {
        navigate('/admin/users');
      } else {
        navigate('/dashboard/listings');
      }
    } catch (error) {
      toast.error('Erro ao excluir produto');
    } finally {
      setIsDeleting(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setIsLoading(true);

      logCategoryOperation('PRODUCT_UPDATE_START', {
        productId: id,
        title: values.title,
        categories: values.categories
      });

      // Validate and sanitize categories before saving
      const categoryValidation = validateAndSanitizeCategories(values.categories);
      
      if (categoryValidation.invalid.length > 0) {
        toast.error(`Categorias inválidas: ${categoryValidation.invalid.join(', ')}`);
        return;
      }
      
      if (categoryValidation.duplicates.length > 0) {
        toast.warning(`Categorias duplicadas removidas: ${categoryValidation.duplicates.join(', ')}`);
      }
      
      const sanitizedCategories = categoryValidation.valid;
      
      if (sanitizedCategories.length === 0) {
        toast.error('Adicione pelo menos uma categoria válida');
        return;
      }

      logCategoryOperation('CATEGORIES_VALIDATED_UPDATE', {
        original: values.categories,
        sanitized: sanitizedCategories,
        removed: [...categoryValidation.invalid, ...categoryValidation.duplicates]
      });

      // Convert currency string to number
      const currencyToNumber = (value: string) => {
        if (!value) return null;
        
        // The DiscountPriceInput now returns clean numeric values
        // So we can directly parse them
        const result = parseFloat(value);
        console.log('Currency conversion:', { input: value, result });
        return isNaN(result) ? null : result;
      };

      const originalPrice = currencyToNumber(values.price);
      const discountedPrice = currencyToNumber(values.discounted_price || '');

      // Validate discount price
      if (discountedPrice && originalPrice && discountedPrice >= originalPrice) {
        toast.error('O preço com desconto deve ser menor que o preço original');
        return;
      }

      // Update product
      const { error: updateError } = await supabase
        .from('products')
        .update({
          title: values.title,
          category: sanitizedCategories, // Use sanitized categories
          brand: values.brand || null,
          gender: values.gender || null,
          colors: values.colors && values.colors.length > 0 ? values.colors : null,
          sizes: [...(values.apparel_sizes || []), ...(values.shoe_sizes || [])].length > 0 ? [...(values.apparel_sizes || []), ...(values.shoe_sizes || [])] : null,
          price: originalPrice,
          discounted_price: discountedPrice,
          is_starting_price: values.is_starting_price,
          description: values.description,
          short_description: values.short_description || null,
          is_visible_on_storefront: values.is_visible_on_storefront,
          external_checkout_url: values.external_checkout_url || null,
        })
        .eq('id', id);

      if (updateError) throw updateError;

      // Handle new images
      if (selectedImages.length > 0) {
        for (let i = 0; i < selectedImages.length; i++) {
          const file = selectedImages[i];
          const fileExt = file.name.split('.').pop();
          const fileName = `${id}-${i}-${Math.random()}.${fileExt}`;
          const filePath = `products/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('public')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('public')
            .getPublicUrl(filePath);

          // If this is going to be the featured image, update all other images first
          if (newFeaturedImageIndex === i) {
            await supabase
              .from('product_images')
              .update({ is_featured: false })
              .eq('product_id', id);
          }

          // Save image reference
          const { error: imageError } = await supabase
            .from('product_images')
            .insert({
              product_id: id,
              url: publicUrl,
              is_featured: newFeaturedImageIndex === i,
            });

          if (imageError) throw imageError;

          // Update product's featured image URL if this is the featured image
          if (newFeaturedImageIndex === i) {
            const { error: updateError } = await supabase
              .from('products')
              .update({ featured_image_url: publicUrl })
              .eq('id', id);

            if (updateError) throw updateError;
          }
        }
      }

      // CRITICAL: Sync categories with storefront settings IMMEDIATELY after product update
      logCategoryOperation('SYNC_START_POST_UPDATE', { userId: productOwnerId });
      if (productOwnerId) {
        try {
          await syncUserCategoriesWithStorefrontSettings(productOwnerId);
          logCategoryOperation('SYNC_COMPLETED_UPDATE', { userId: productOwnerId });
        } catch (syncError) {
          logCategoryOperation('SYNC_ERROR_UPDATE', syncError);
        }
        
        // Add additional delay to ensure the sync is fully processed
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      toast.success('Produto atualizado com sucesso!');
      
      // Redirect based on user role
      if (user?.role === 'admin' || user?.role === 'parceiro') {
        navigate('/admin/users');
      } else {
        navigate('/dashboard/listings');
      }
    } catch (error) {
      logCategoryOperation('PRODUCT_UPDATE_FAILED', { productId: id, error });
      toast.error('Erro ao atualizar produto');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Editar Produto</CardTitle>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir Produto
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. Isso excluirá permanentemente o produto
                  e todas as suas imagens.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {isDeleting ? 'Excluindo...' : 'Sim, excluir produto'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Card 1: Informações Básicas - Nome, Categorias, Marca, Gênero */}
              <Card>
                <CardHeader>
                  <CardTitle>Informações Básicas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do Produto</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome do produto" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="categories"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categorias</FormLabel>
                        <FormControl>
                          <TagInput
                            value={field.value}
                            onChange={field.onChange}
                            suggestions={categories.map(c => c.name)}
                            placeholder="Adicionar categoria..."
                            maxTags={5}
                          />
                        </FormControl>
                        <FormDescription>
                          Adicione até 5 categorias para seu produto. A primeira categoria será a principal.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="brand"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Marca (opcional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Marca do produto" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gênero (opcional)</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o gênero" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="masculino">Masculino</SelectItem>
                              <SelectItem value="feminino">Feminino</SelectItem>
                              <SelectItem value="unissex">Unissex</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Card 2: Tamanhos e Cores */}
              <Card>
                <CardHeader>
                  <CardTitle>Tamanhos e Cores Disponíveis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Cores Colapsáveis */}
                  <Collapsible open={colorsOpen} onOpenChange={setColorsOpen}>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between"
                        type="button"
                      >
                        Cores Disponíveis (opcional)
                        <ChevronDown className={`h-4 w-4 transition-transform ${colorsOpen ? 'rotate-180' : ''}`} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-6 mt-4">
                      <FormField
                        control={form.control}
                        name="colors"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cores Disponíveis</FormLabel>
                            <FormControl>
                              <CustomColorSelector
                                value={field.value || []}
                                onChange={field.onChange}
                                userId={user?.id}
                                maxColors={10}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Tamanhos Colapsáveis */}
                  <Collapsible open={sizesOpen} onOpenChange={setSizesOpen}>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between"
                        type="button"
                      >
                        Tamanhos (opcional)
                        <ChevronDown className={`h-4 w-4 transition-transform ${sizesOpen ? 'rotate-180' : ''}`} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-6 mt-4">
                      <FormField
                        control={form.control}
                        name="apparel_sizes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tamanhos de Vestuário</FormLabel>
                            <FormControl>
                              <ApparelSizeSelector
                                value={field.value || []}
                                onChange={field.onChange}
                                maxSizes={15}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="shoe_sizes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Numeração de Calçados</FormLabel>
                            <FormControl>
                              <ShoeSizeSelector
                                value={field.value || []}
                                onChange={field.onChange}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="custom_sizes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tamanhos Personalizados</FormLabel>
                            <FormControl>
                              <CustomSizeInput
                                value={field.value || []}
                                onChange={field.onChange}
                                userId={user?.id}
                                maxSizes={10}
                              />
                            </FormControl>
                            <FormDescription>
                              Digite tamanhos personalizados como "XS", "2XL", "Único", etc. Os tamanhos criados serão salvos para uso futuro.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>

              {/* Card 3: Preços */}
              <Card>
                <CardHeader>
                  <CardTitle>Preços</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <DiscountPriceInput
                            originalPrice={field.value}
                            discountedPrice={form.watch('discounted_price') || ''}
                            onOriginalPriceChange={field.onChange}
                            onDiscountedPriceChange={(value) => form.setValue('discounted_price', value)}
                            currency={user?.currency || 'BRL'}
                            locale={user?.language || 'pt-BR'}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="is_starting_price"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Preço inicial
                          </FormLabel>
                          <FormDescription>
                            Marque esta opção se o preço informado é um valor inicial ("A partir de")
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Card 4: Descrições */}
              <Card>
                <CardHeader>
                  <CardTitle>Frase Promocional e Descrição</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="short_description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Frase Promocional (opcional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Ex: Em até 4x nos cartões ou 10%OFF no Pix"
                            className="resize-none"
                            maxLength={60}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição Completa</FormLabel>
                        <FormControl>
                          <RichTextEditor
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Descrição detalhada do produto"
                            isOptional={true}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Card 5: Imagens do Produto */}
              <Card>
                <CardHeader>
                  <CardTitle>Imagens do Produto</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Imagens existentes */}
                  {existingImages.length > 0 && (
                    <div className="space-y-4">
                      <FormLabel>Imagens Atuais</FormLabel>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {existingImages.map((image) => (
                          <div key={image.id} className="relative group">
                            {/* Container da imagem EXATAMENTE como na imagem de referência */}
                            <div className="aspect-square overflow-hidden rounded-lg bg-white border border-gray-200 shadow-sm">
                              <img
                                src={image.url}
                                alt="Imagem do produto"
                                className="w-full h-full object-cover"
                                style={{ 
                                  backgroundColor: '#ffffff',
                                  backgroundImage: 'none'
                                }}
                              />
                            </div>
                            <div className="absolute top-2 right-2 flex gap-2">
                              <Button
                                type="button"
                                size="icon"
                                variant="secondary"
                                className="h-8 w-8"
                                onClick={() => setCroppingExistingImageId(image.id)}
                                disabled={isLoading}
                              >
                                <Crop className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant={image.id === featuredImageId ? "default" : "secondary"}
                                className="h-8 w-8"
                                onClick={() => setExistingImageAsFeatured(image.id)}
                                disabled={isLoading}
                              >
                                <Star className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="destructive"
                                className="h-8 w-8"
                                onClick={() => removeExistingImage(image.id)}
                                disabled={isLoading}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            {image.id === featuredImageId && (
                              <div className="absolute bottom-2 left-2 bg-primary text-primary-foreground px-2 py-1 rounded-full text-xs">
                                Principal
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upload de novas imagens */}
                  <div>
                    <FormLabel>Adicionar Novas Imagens ({10 - existingImages.length} restantes)</FormLabel>
                    <div className="mt-2">
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                          <p className="mb-2 text-sm text-muted-foreground">
                            Clique para fazer upload ou arraste as imagens
                          </p>
                          <p className="text-xs text-muted-foreground">
                            PNG, JPG ou WEBP (MAX. 5MB)
                          </p>
                          <p className="text-xs text-primary font-medium mt-1">
                            Recomendado: 1000x1000px ou superior para melhor qualidade
                          </p>
                        </div>
                        <Input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          multiple
                          onChange={handleImageSelect}
                          disabled={isLoading}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Preview das novas imagens */}
                  {previewUrls.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {previewUrls.map((url, index) => (
                        <div key={url} className="relative group">
                          {/* Container da imagem EXATAMENTE como na imagem de referência */}
                          <div className="aspect-square overflow-hidden rounded-lg bg-white border border-gray-200 shadow-sm">
                            <img
                              src={url}
                              alt={`Preview ${index + 1}`}
                              className="w-full h-full object-cover"
                              style={{ 
                                backgroundColor: '#ffffff',
                                backgroundImage: 'none'
                              }}
                            />
                          </div>
                          <div className="absolute top-2 right-2 flex gap-2">
                            <Button
                              type="button"
                              size="icon"
                              variant="secondary"
                              className="h-8 w-8"
                              onClick={() => setCroppingNewImageIndex(index)}
                            >
                              <Crop className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant={newFeaturedImageIndex === index ? "default" : "secondary"}
                              className="h-8 w-8"
                              onClick={() => setNewImageAsFeatured(index)}
                            >
                              <Star className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="destructive"
                              className="h-8 w-8"
                              onClick={() => removeNewImage(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          {newFeaturedImageIndex === index && (
                            <div className="absolute bottom-2 left-2 bg-primary text-primary-foreground px-2 py-1 rounded-full text-xs">
                              Principal
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Card 6: Link de Checkout Externo */}
              <Card>
                <CardHeader>
                  <CardTitle>Link Externo</CardTitle>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="external_checkout_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Link de Checkout Externo (opcional)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="https://exemplo.com/checkout/produto" 
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Se preenchido, será exibido um botão "Comprar" na vitrine que direcionará para este link
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Card 7: Configurações da Vitrine */}
              <Card>
                <CardHeader>
                  <CardTitle>Mostrar na Vitrine</CardTitle>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="is_visible_on_storefront"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Mostrar na Vitrine
                          </FormLabel>
                          <FormDescription>
                            Define se o produto será visível na sua vitrine pública.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    // Redirect based on user role
                    if (user?.role === 'admin' || user?.role === 'parceiro') {
                      navigate('/admin/users');
                    } else {
                      navigate('/dashboard/listings');
                    }
                  }}
                  disabled={isLoading}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isLoading ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* New Image Cropper Dialog */}
      {croppingNewImageIndex !== null && (
        <Dialog open={true} onOpenChange={() => setCroppingNewImageIndex(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Cortar Nova Imagem</DialogTitle>
              <DialogDescription>
                Ajuste a área de corte da imagem para o formato quadrado (1:1) ideal para e-commerce
              </DialogDescription>
            </DialogHeader>
            <ImageCropperProduct
              image={previewUrls[croppingNewImageIndex]}
              onCrop={handleNewImageCropComplete}
              onCancel={() => setCroppingNewImageIndex(null)}
              aspectRatio={1}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Existing Image Cropper Dialog */}
      {croppingExistingImageId && (
        <Dialog open={true} onOpenChange={() => setCroppingExistingImageId(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Cortar Imagem Existente</DialogTitle>
              <DialogDescription>
                Ajuste a área de corte da imagem para o formato quadrado (1:1) ideal para e-commerce
              </DialogDescription>
            </DialogHeader>
            <ImageCropperProduct
              image={existingImages.find(img => img.id === croppingExistingImageId)?.url || ''}
              onCrop={handleExistingImageCropComplete}
              onCancel={() => setCroppingExistingImageId(null)}
              aspectRatio={1}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}