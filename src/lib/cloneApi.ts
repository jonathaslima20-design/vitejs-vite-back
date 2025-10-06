/**
 * Enhanced Clone API - Completely refactored for reliability
 * Handles both admin (JWT) and public (API Key) cloning operations
 */

import { supabase } from './supabase';
import { toast } from 'sonner';

export interface CloneResult {
  success: boolean;
  categoriesCloned: number;
  productsCloned: number;
  imagesCloned: number;
  errors: string[];
  skipped: number;
  totalProcessed: number;
}

export interface CloneProgress {
  current: number;
  total: number;
  message: string;
  percentage: number;
}

export interface CloneOptions {
  cloneCategories: boolean;
  cloneProducts: boolean;
  mergeStrategy: 'merge' | 'replace';
  copyImages: boolean;
  maxProducts?: number;
}

/**
 * Clone products and categories using admin privileges (JWT required)
 */
export async function cloneUserDataAdmin(
  sourceUserId: string,
  targetUserId: string,
  options: CloneOptions,
  onProgress?: (progress: CloneProgress) => void
): Promise<CloneResult> {
  const result: CloneResult = {
    success: false,
    categoriesCloned: 0,
    productsCloned: 0,
    imagesCloned: 0,
    errors: [],
    skipped: 0,
    totalProcessed: 0
  };

  try {
    console.log('🚀 Starting admin clone operation:', {
      sourceUserId: sourceUserId.substring(0, 8),
      targetUserId: targetUserId.substring(0, 8),
      options
    });

    // Validate session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      throw new Error('Sessão inválida. Faça login novamente.');
    }

    // Validate users exist
    onProgress?.({ current: 1, total: 10, message: 'Validando usuários...', percentage: 10 });
    
    const [sourceUser, targetUser] = await Promise.all([
      supabase.from('users').select('id, name, listing_limit').eq('id', sourceUserId).single(),
      supabase.from('users').select('id, name, listing_limit').eq('id', targetUserId).single()
    ]);

    if (sourceUser.error || !sourceUser.data) {
      throw new Error('Usuário de origem não encontrado');
    }

    if (targetUser.error || !targetUser.data) {
      throw new Error('Usuário de destino não encontrado');
    }

    console.log('✅ Users validated:', {
      source: sourceUser.data.name,
      target: targetUser.data.name
    });

    // Clone categories if requested
    if (options.cloneCategories) {
      onProgress?.({ current: 2, total: 10, message: 'Clonando categorias...', percentage: 20 });
      
      const categoriesResult = await cloneCategories(sourceUserId, targetUserId, options.mergeStrategy);
      result.categoriesCloned = categoriesResult.cloned;
      result.errors.push(...categoriesResult.errors);
    }

    // Clone products if requested
    if (options.cloneProducts) {
      onProgress?.({ current: 4, total: 10, message: 'Clonando produtos...', percentage: 40 });
      
      const productsResult = await cloneProducts(
        sourceUserId, 
        targetUserId, 
        options, 
        (progress) => {
          onProgress?.({
            current: 4 + Math.round(progress.percentage * 0.05), // 4-9 range
            total: 10,
            message: progress.message,
            percentage: 40 + (progress.percentage * 0.5) // 40-90% range
          });
        }
      );
      
      result.productsCloned = productsResult.productsCloned;
      result.imagesCloned = productsResult.imagesCloned;
      result.skipped = productsResult.skipped;
      result.errors.push(...productsResult.errors);
    }

    onProgress?.({ current: 10, total: 10, message: 'Finalizando...', percentage: 100 });

    result.success = result.categoriesCloned > 0 || result.productsCloned > 0;
    result.totalProcessed = result.categoriesCloned + result.productsCloned;

    console.log('✅ Clone operation completed:', result);
    return result;

  } catch (error: any) {
    console.error('❌ Clone operation failed:', error);
    result.errors.push(error.message || 'Erro inesperado');
    return result;
  }
}

/**
 * Clone products and categories using public API (API Key required)
 */
export async function cloneUserDataPublic(
  apiKey: string,
  sourceUserId: string,
  targetUserId: string,
  options: CloneOptions,
  onProgress?: (progress: CloneProgress) => void
): Promise<CloneResult> {
  const result: CloneResult = {
    success: false,
    categoriesCloned: 0,
    productsCloned: 0,
    imagesCloned: 0,
    errors: [],
    skipped: 0,
    totalProcessed: 0
  };

  try {
    if (!apiKey) {
      throw new Error('API Key é obrigatória');
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('VITE_SUPABASE_URL não configurada');
    }

    onProgress?.({ current: 1, total: 10, message: 'Iniciando clonagem...', percentage: 10 });

    const response = await fetch(`${supabaseUrl}/functions/v1/enhanced-clone-products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        sourceUserId,
        targetUserId,
        options
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData?.error?.message ||
        `Erro HTTP ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();

    if (data?.error) {
      throw new Error(data.error.message || 'Erro na clonagem');
    }

    if (!data?.stats) {
      throw new Error('Resposta inválida da função');
    }

    onProgress?.({ current: 10, total: 10, message: 'Clonagem concluída!', percentage: 100 });

    return {
      success: true,
      categoriesCloned: data.stats.categoriesCloned || 0,
      productsCloned: data.stats.productsCloned || 0,
      imagesCloned: data.stats.imagesCloned || 0,
      errors: data.stats.errors || [],
      skipped: data.stats.skipped || 0,
      totalProcessed: (data.stats.categoriesCloned || 0) + (data.stats.productsCloned || 0)
    };

  } catch (error: any) {
    console.error('Error calling public clone API:', error);
    result.errors.push(error.message || 'Erro na clonagem pública');
    return result;
  }
}

/**
 * Internal function to clone categories
 */
async function cloneCategories(
  sourceUserId: string,
  targetUserId: string,
  mergeStrategy: 'merge' | 'replace'
): Promise<{ cloned: number; errors: string[] }> {
  try {
    console.log('📁 Cloning categories...');

    // Get source categories
    const { data: sourceCategories, error: fetchError } = await supabase
      .from('user_product_categories')
      .select('name')
      .eq('user_id', sourceUserId);

    if (fetchError) {
      throw new Error(`Erro ao buscar categorias: ${fetchError.message}`);
    }

    if (!sourceCategories || sourceCategories.length === 0) {
      console.log('ℹ️ No categories to clone');
      return { cloned: 0, errors: [] };
    }

    // Handle replace strategy
    if (mergeStrategy === 'replace') {
      const { error: deleteError } = await supabase
        .from('user_product_categories')
        .delete()
        .eq('user_id', targetUserId);

      if (deleteError) {
        throw new Error(`Erro ao limpar categorias existentes: ${deleteError.message}`);
      }
    }

    // Get existing categories for merge strategy
    let existingCategories: string[] = [];
    if (mergeStrategy === 'merge') {
      const { data: existing } = await supabase
        .from('user_product_categories')
        .select('name')
        .eq('user_id', targetUserId);

      existingCategories = existing?.map(c => c.name.toLowerCase()) || [];
    }

    // Filter categories to insert
    const categoriesToInsert = mergeStrategy === 'merge'
      ? sourceCategories.filter(cat => !existingCategories.includes(cat.name.toLowerCase()))
      : sourceCategories;

    if (categoriesToInsert.length === 0) {
      console.log('ℹ️ No new categories to insert');
      return { cloned: 0, errors: [] };
    }

    // Insert categories
    const { error: insertError } = await supabase
      .from('user_product_categories')
      .insert(
        categoriesToInsert.map(cat => ({
          user_id: targetUserId,
          name: cat.name
        }))
      );

    if (insertError) {
      throw new Error(`Erro ao inserir categorias: ${insertError.message}`);
    }

    console.log(`✅ Cloned ${categoriesToInsert.length} categories`);
    return { cloned: categoriesToInsert.length, errors: [] };

  } catch (error: any) {
    console.error('❌ Error cloning categories:', error);
    return { cloned: 0, errors: [error.message] };
  }
}

/**
 * Internal function to clone products
 */
async function cloneProducts(
  sourceUserId: string,
  targetUserId: string,
  options: CloneOptions,
  onProgress?: (progress: CloneProgress) => void
): Promise<{ productsCloned: number; imagesCloned: number; skipped: number; errors: string[] }> {
  const result = {
    productsCloned: 0,
    imagesCloned: 0,
    skipped: 0,
    errors: []
  };

  try {
    console.log('📦 Cloning products...');

    // Get source products
    const { data: sourceProducts, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', sourceUserId)
      .limit(options.maxProducts || 1000);

    if (fetchError) {
      throw new Error(`Erro ao buscar produtos: ${fetchError.message}`);
    }

    if (!sourceProducts || sourceProducts.length === 0) {
      console.log('ℹ️ No products to clone');
      return result;
    }

    console.log(`📦 Found ${sourceProducts.length} products to clone`);

    // Handle replace strategy
    if (options.mergeStrategy === 'replace') {
      onProgress?.({ current: 0, total: sourceProducts.length, message: 'Removendo produtos existentes...', percentage: 0 });
      
      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .eq('user_id', targetUserId);

      if (deleteError) {
        throw new Error(`Erro ao limpar produtos existentes: ${deleteError.message}`);
      }
    }

    // Clone products one by one for better control
    for (let i = 0; i < sourceProducts.length; i++) {
      const product = sourceProducts[i];
      const progress = Math.round(((i + 1) / sourceProducts.length) * 100);
      
      onProgress?.({
        current: i + 1,
        total: sourceProducts.length,
        message: `Clonando: ${product.title.substring(0, 30)}...`,
        percentage: progress
      });

      try {
        // Create new product
        const { data: newProduct, error: productError } = await supabase
          .from('products')
          .insert({
            user_id: targetUserId,
            title: product.title,
            description: product.description,
            price: product.price,
            discounted_price: product.discounted_price,
            status: product.status,
            category: product.category,
            brand: product.brand,
            model: product.model,
            gender: product.gender,
            condition: product.condition,
            video_url: product.video_url,
            featured_offer_price: product.featured_offer_price,
            featured_offer_installment: product.featured_offer_installment,
            featured_offer_description: product.featured_offer_description,
            is_starting_price: product.is_starting_price,
            short_description: product.short_description,
            is_visible_on_storefront: product.is_visible_on_storefront,
            external_checkout_url: product.external_checkout_url,
            colors: product.colors,
            sizes: product.sizes,
            display_order: product.display_order
          })
          .select()
          .single();

        if (productError) {
          console.error(`❌ Error creating product "${product.title}":`, productError);
          result.errors.push(`Erro ao criar produto "${product.title}": ${productError.message}`);
          result.skipped++;
          continue;
        }

        result.productsCloned++;
        console.log(`✅ Product created: ${newProduct.title}`);

        // Clone images if requested
        if (options.copyImages) {
          const imagesResult = await cloneProductImages(product.id, newProduct.id);
          result.imagesCloned += imagesResult.cloned;
          result.errors.push(...imagesResult.errors);
        }

      } catch (productError: any) {
        console.error(`❌ Error processing product "${product.title}":`, productError);
        result.errors.push(`Erro ao processar produto "${product.title}": ${productError.message}`);
        result.skipped++;
      }
    }

    return result;

  } catch (error: any) {
    console.error('❌ Error cloning products:', error);
    result.errors.push(error.message || 'Erro inesperado na clonagem de produtos');
    return result;
  }
}

/**
 * Internal function to clone product images
 */
async function cloneProductImages(
  sourceProductId: string,
  targetProductId: string
): Promise<{ cloned: number; errors: string[] }> {
  const result = { cloned: 0, errors: [] };

  try {
    // Get source images
    const { data: sourceImages, error: fetchError } = await supabase
      .from('product_images')
      .select('*')
      .eq('product_id', sourceProductId);

    if (fetchError) {
      throw new Error(`Erro ao buscar imagens: ${fetchError.message}`);
    }

    if (!sourceImages || sourceImages.length === 0) {
      return result;
    }

    console.log(`🖼️ Cloning ${sourceImages.length} images...`);
    let featuredImageUrl = null;

    for (const image of sourceImages) {
      try {
        // Download image with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const imageResponse = await fetch(image.url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'VitrineTurbo-Clone/2.0' }
        });

        clearTimeout(timeoutId);

        if (!imageResponse.ok) {
          result.errors.push(`Falha ao baixar imagem: HTTP ${imageResponse.status}`);
          continue;
        }

        const imageBlob = await imageResponse.blob();
        
        // Validate image size
        if (imageBlob.size > 10 * 1024 * 1024) {
          result.errors.push('Imagem muito grande (>10MB), pulando...');
          continue;
        }

        // Generate unique filename
        const fileExtension = image.url.split('.').pop()?.split('?')[0] || 'jpg';
        const newFileName = `${targetProductId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExtension}`;
        const newFilePath = `products/${newFileName}`;

        // Upload image
        const { error: uploadError } = await supabase.storage
          .from('public')
          .upload(newFilePath, imageBlob, {
            contentType: imageBlob.type,
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          result.errors.push(`Erro no upload: ${uploadError.message}`);
          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('public')
          .getPublicUrl(newFilePath);

        // Save image reference
        const { error: insertError } = await supabase
          .from('product_images')
          .insert({
            product_id: targetProductId,
            url: publicUrl,
            is_featured: image.is_featured
          });

        if (insertError) {
          result.errors.push(`Erro ao salvar referência: ${insertError.message}`);
          // Clean up uploaded file
          await supabase.storage.from('public').remove([newFilePath]);
          continue;
        }

        if (image.is_featured) {
          featuredImageUrl = publicUrl;
        }

        result.cloned++;
        console.log(`✅ Image cloned: ${newFileName}`);

      } catch (imageError: any) {
        console.error('❌ Error cloning image:', imageError);
        result.errors.push(`Erro na imagem: ${imageError.message}`);
      }
    }

    // Update featured image URL
    if (featuredImageUrl) {
      await supabase
        .from('products')
        .update({ featured_image_url: featuredImageUrl })
        .eq('id', targetProductId);
    }

    return result;

  } catch (error: any) {
    console.error('❌ Error in cloneProductImages:', error);
    result.errors.push(error.message || 'Erro inesperado na clonagem de imagens');
    return result;
  }
}

/**
 * Quick clone without images (ultra-fast)
 */
export async function quickCloneProducts(
  sourceUserId: string,
  targetUserId: string,
  onProgress?: (progress: CloneProgress) => void
): Promise<CloneResult> {
  return cloneUserDataAdmin(sourceUserId, targetUserId, {
    cloneCategories: true,
    cloneProducts: true,
    mergeStrategy: 'merge',
    copyImages: false
  }, onProgress);
}

/**
 * Full clone with images (slower but complete)
 */
export async function fullCloneProducts(
  sourceUserId: string,
  targetUserId: string,
  onProgress?: (progress: CloneProgress) => void
): Promise<CloneResult> {
  return cloneUserDataAdmin(sourceUserId, targetUserId, {
    cloneCategories: true,
    cloneProducts: true,
    mergeStrategy: 'merge',
    copyImages: true
  }, onProgress);
}

/**
 * Validate clone operation before execution
 */
export async function validateCloneOperation(
  sourceUserId: string,
  targetUserId: string,
  options: CloneOptions
): Promise<{
  valid: boolean;
  warnings: string[];
  sourceStats: { categories: number; products: number };
  targetStats: { categories: number; products: number; limit: number };
}> {
  const warnings: string[] = [];

  try {
    // Get source stats
    const [sourceCategoriesResult, sourceProductsResult] = await Promise.all([
      supabase.from('user_product_categories').select('*', { count: 'exact', head: true }).eq('user_id', sourceUserId),
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('user_id', sourceUserId)
    ]);

    // Get target stats
    const [targetCategoriesResult, targetProductsResult, targetUserResult] = await Promise.all([
      supabase.from('user_product_categories').select('*', { count: 'exact', head: true }).eq('user_id', targetUserId),
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('user_id', targetUserId),
      supabase.from('users').select('listing_limit').eq('id', targetUserId).single()
    ]);

    const sourceStats = {
      categories: sourceCategoriesResult.count || 0,
      products: sourceProductsResult.count || 0
    };

    const targetStats = {
      categories: targetCategoriesResult.count || 0,
      products: targetProductsResult.count || 0,
      limit: targetUserResult.data?.listing_limit || 50
    };

    // Validate limits
    if (options.cloneProducts && options.mergeStrategy === 'merge') {
      const totalAfterClone = targetStats.products + sourceStats.products;
      if (totalAfterClone > targetStats.limit) {
        warnings.push(`Limite de produtos será excedido: ${totalAfterClone} > ${targetStats.limit}`);
      }
    }

    // Check if source has data
    if (options.cloneCategories && sourceStats.categories === 0) {
      warnings.push('Usuário de origem não possui categorias');
    }

    if (options.cloneProducts && sourceStats.products === 0) {
      warnings.push('Usuário de origem não possui produtos');
    }

    return {
      valid: warnings.length === 0,
      warnings,
      sourceStats,
      targetStats
    };

  } catch (error: any) {
    return {
      valid: false,
      warnings: [`Erro na validação: ${error.message}`],
      sourceStats: { categories: 0, products: 0 },
      targetStats: { categories: 0, products: 0, limit: 0 }
    };
  }
}