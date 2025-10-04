import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { toast } from 'sonner';
import { Upload, X, Loader2, Star, Crop, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { TagInput } from '@/components/ui/tag-input';
import { CustomSizeInput } from '@/components/ui/custom-size-input';
import { syncUserCategoriesWithStorefrontSettings } from '@/lib/utils';
import { validateAndSanitizeCategories, logCategoryOperation, sanitizeCategoryName } from '@/lib/categoryUtils';
import { CustomColorSelector } from '@/components/ui/custom-color-selector';

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
import { ApparelSizeSelector } from '@/components/ui/apparel-size-selector';
import { ShoeSizeSelector } from '@/components/ui/shoe-size-selector';
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

export default function CreateProductPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [newFeaturedImageIndex, setNewFeaturedImageIndex] = useState<number | null>(null);
  const [croppingImageIndex, setCroppingImageIndex] = useState<number | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [sizesOpen, setSizesOpen] = useState(false);
  const [colorsOpen, setColorsOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

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
    const fetchCategories = async () => {
      try {
        const { data, error } = await supabase
          .from('user_product_categories')
          .select('id, name')
          .eq('user_id', user?.id);

        if (error) throw error;
        setCategories(data || []);
      } catch (error) {
        console.error('Error fetching categories:', error);
        toast.error('Erro ao carregar categorias');
      }
    };

    fetchCategories();
  }, [user?.id]);

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newFiles: File[] = [];
    const newUrls: string[] = [];

    // Check each file
    Array.from(files).forEach(file => {
      // Check file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`Arquivo ${file.name} excede o limite de 5MB`);
        return;
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        toast.error(`Arquivo ${file.name} não é uma imagem válida`);
        return;
      }

      newFiles.push(file);
      newUrls.push(URL.createObjectURL(file));
    });

    // Update state
    setSelectedImages(prev => [...prev, ...newFiles]);
    setPreviewUrls(prev => [...prev, ...newUrls]);

    // If this is the first image, set it as featured
    if (newFeaturedImageIndex === null && newUrls.length > 0) {
      setNewFeaturedImageIndex(0);
    }

    // Clear the input
    event.target.value = '';
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => {
      // Revoke the URL to prevent memory leaks
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });

    // Update featured image index if necessary
    if (newFeaturedImageIndex === index) {
      setNewFeaturedImageIndex(null);
    } else if (newFeaturedImageIndex !== null && newFeaturedImageIndex > index) {
      setNewFeaturedImageIndex(newFeaturedImageIndex - 1);
    }

    // Update cropping image index if necessary
    if (croppingImageIndex === index) {
      setCroppingImageIndex(null);
    } else if (croppingImageIndex !== null && croppingImageIndex > index) {
      setCroppingImageIndex(croppingImageIndex - 1);
    }
  };

  const handleCropComplete = (croppedBlob: Blob) => {
    if (croppingImageIndex === null) return;

    // Create a new File from the cropped blob
    const croppedFile = new File([croppedBlob], `cropped-${Date.now()}.jpg`, {
      type: 'image/jpeg',
    });

    // Update the selected images array
    setSelectedImages(prev => prev.map((file, index) => 
      index === croppingImageIndex ? croppedFile : file
    ));

    // Update the preview URLs
    setPreviewUrls(prev => {
      const newUrls = [...prev];
      // Revoke the old URL
      URL.revokeObjectURL(newUrls[croppingImageIndex]);
      // Create new URL for cropped image
      newUrls[croppingImageIndex] = URL.createObjectURL(croppedFile);
      return newUrls;
    });

    // Reset cropping state
    setCroppingImageIndex(null);
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setIsLoading(true);

      logCategoryOperation('PRODUCT_CREATION_START', {
        title: values.title,
        categories: values.categories,
        imagesCount: selectedImages.length,
        userId: user?.id
      });

      if (selectedImages.length === 0) {
        toast.error('Adicione pelo menos uma imagem');
        return;
      }

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

      logCategoryOperation('CATEGORIES_VALIDATED', {
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

      console.log('Processed prices:', { originalPrice, discountedPrice });

      // Only validate price if it's provided
      if (values.price && (!originalPrice || originalPrice <= 0)) {
        toast.error('Preço inválido. Verifique o valor informado.');
        return;
      }

      // Validate discount price
      if (discountedPrice && originalPrice && discountedPrice >= originalPrice) {
        toast.error('O preço com desconto deve ser menor que o preço original');
        return;
      }

      const productData = {
        title: values.title,
        category: sanitizedCategories, // Use sanitized categories
        brand: values.brand || null,
        gender: values.gender || null,
        colors: values.colors && values.colors.length > 0 ? values.colors : null,
        sizes: [...(values.apparel_sizes || []), ...(values.shoe_sizes || []), ...(values.custom_sizes || [])].length > 0 ? [...(values.apparel_sizes || []), ...(values.shoe_sizes || []), ...(values.custom_sizes || [])] : null,
        price: originalPrice,
        discounted_price: discountedPrice,
        is_starting_price: values.is_starting_price,
        description: values.description,
        short_description: values.short_description || null,
        status: 'disponivel',
        is_visible_on_storefront: values.is_visible_on_storefront,
        external_checkout_url: values.external_checkout_url || null,
        user_id: user?.id,
      };

      logCategoryOperation('CREATING_PRODUCT', productData);

      // Create the product
      const { data: product, error: productError } = await supabase
        .from('products')
        .insert(productData)
        .select()
        .single();

      if (productError) {
        logCategoryOperation('PRODUCT_CREATION_ERROR', productError);
        throw new Error(`Erro ao criar produto: ${productError.message}`);
      }

      logCategoryOperation('PRODUCT_CREATED', { id: product.id, title: product.title });

      // Upload images
      logCategoryOperation('IMAGE_UPLOAD_START', { count: selectedImages.length });
      for (let i = 0; i < selectedImages.length; i++) {
        const file = selectedImages[i];
        console.log(`Uploading image ${i + 1}/${selectedImages.length}:`, {
          name: file.name,
          size: file.size,
          type: file.type
        });

        const fileExt = file.name.split('.').pop();
        const fileName = `${product.id}-${i}-${Math.random()}.${fileExt}`;
        const filePath = `products/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('public')
          .upload(filePath, file);

        if (uploadError) {
          console.error(`Image upload error for image ${i}:`, uploadError);
          throw new Error(`Erro ao fazer upload da imagem ${i + 1}: ${uploadError.message}`);
        }

        console.log(`Image ${i + 1} uploaded successfully to:`, filePath);

        const { data: { publicUrl } } = supabase.storage
          .from('public')
          .getPublicUrl(filePath);

        console.log(`Public URL for image ${i + 1}:`, publicUrl);

        // Save image reference
        const { error: imageError } = await supabase
          .from('product_images')
          .insert({
            product_id: product.id,
            url: publicUrl,
            is_featured: newFeaturedImageIndex === i,
          });

        if (imageError) {
          console.error(`Image reference save error for image ${i}:`, imageError);
          throw new Error(`Erro ao salvar referência da imagem ${i + 1}: ${imageError.message}`);
        }

        console.log(`Image ${i + 1} reference saved successfully`);

        // Update product's featured image URL if this is the featured image
        if (newFeaturedImageIndex === i) {
          console.log(`Setting image ${i + 1} as featured image`);
          const { error: updateError } = await supabase
            .from('products')
            .update({ featured_image_url: publicUrl })
            .eq('id', product.id);

          if (updateError) {
            console.error('Featured image update error:', updateError);
            throw new Error(`Erro ao definir imagem principal: ${updateError.message}`);
          }

          console.log('Featured image updated successfully');
        }
      }

      // CRITICAL: Sync categories with storefront settings IMMEDIATELY after product creation
      logCategoryOperation('SYNC_START_POST_CREATION', { userId: user?.id });
      if (user?.id) {
        try {
          await syncUserCategoriesWithStorefrontSettings(user.id);
          logCategoryOperation('SYNC_COMPLETED', { userId: user?.id });
        } catch (syncError) {
          logCategoryOperation('SYNC_ERROR_NON_CRITICAL', syncError);
          // Don't fail the entire operation for sync errors
        }
        
        // Add additional delay to ensure the sync is fully processed
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      logCategoryOperation('PRODUCT_CREATION_COMPLETE', { productId: product.id });
      toast.success('Produto cadastrado com sucesso!');
      navigate('/dashboard/listings');
    } catch (error: any) {
      logCategoryOperation('PRODUCT_CREATION_FAILED', error);
      
      // Provide more specific error messages
      if (error.message) {
        toast.error(error.message);
      } else if (error.code) {
        toast.error(`Erro do sistema: ${error.code}`);
      } else {
        toast.error('Erro ao cadastrar produto. Tente novamente.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Cadastrar Novo Produto</CardTitle>
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
                  <div>
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

                  {/* Preview das imagens */}
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
                              loading="lazy"
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
                              onClick={() => setCroppingImageIndex(index)}
                            >
                              <Crop className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant={newFeaturedImageIndex === index ? "default" : "secondary"}
                              className="h-8 w-8"
                              onClick={() => setNewFeaturedImageIndex(index)}
                            >
                              <Star className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="destructive"
                              className="h-8 w-8"
                              onClick={() => removeImage(index)}
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
                  onClick={() => navigate('/dashboard/listings')}
                  disabled={isLoading}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Cadastrar Produto
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Image Cropper Dialog */}
      {croppingImageIndex !== null && (
        <Dialog open={true} onOpenChange={() => setCroppingImageIndex(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Cortar Imagem</DialogTitle>
              <DialogDescription>
                Ajuste a área de corte da imagem para o formato quadrado (1:1) ideal para e-commerce
              </DialogDescription>
            </DialogHeader>
            <ImageCropperProduct
              image={previewUrls[croppingImageIndex]}
              onCrop={handleCropComplete}
              onCancel={() => setCroppingImageIndex(null)}
              aspectRatio={1}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}