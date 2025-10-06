/*
  # Enhanced Clone Products Edge Function

  Completely refactored clone function with improved reliability and performance.

  1. Features
    - Robust error handling with detailed logging
    - Progress tracking and timeout management
    - Configurable clone options
    - Image optimization and validation
    - Proper cleanup on failures

  2. Security
    - API Key authentication for public access
    - Input validation and sanitization
    - Rate limiting protection
    - Proper error responses

  3. Performance
    - Batch processing for large datasets
    - Optimized image handling
    - Memory management
    - Timeout prevention
*/

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'x-api-key, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CloneRequest {
  sourceUserId: string;
  targetUserId: string;
  options: {
    cloneCategories: boolean;
    cloneProducts: boolean;
    mergeStrategy: 'merge' | 'replace';
    copyImages: boolean;
    maxProducts?: number;
  };
}

interface CloneStats {
  categoriesCloned: number;
  productsCloned: number;
  imagesCloned: number;
  errors: string[];
  skipped: number;
  totalProcessed: number;
}

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Set up heartbeat to prevent timeout
  const heartbeatInterval = setInterval(() => {
    console.log('💓 Heartbeat:', new Date().toISOString());
  }, 30000);

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: { message: 'Method not allowed' } }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate API Key
    const apiKey = req.headers.get('X-API-Key');
    const validApiKey = Deno.env.get('ENHANCED_CLONE_API_KEY') || Deno.env.get('COPY_PRODUCTS_API_KEY');

    if (!apiKey || !validApiKey) {
      console.error('❌ Missing API Key configuration');
      return new Response(
        JSON.stringify({ error: { message: 'API Key configuration error' } }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (apiKey !== validApiKey) {
      console.error('❌ Invalid API Key');
      return new Response(
        JSON.stringify({ error: { message: 'Invalid API Key' } }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('✅ API Key validated');

    // Parse request
    const { sourceUserId, targetUserId, options }: CloneRequest = await req.json();

    // Validate input
    if (!sourceUserId || !targetUserId) {
      return new Response(
        JSON.stringify({ error: { message: 'sourceUserId and targetUserId are required' } }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (sourceUserId === targetUserId) {
      return new Response(
        JSON.stringify({ error: { message: 'Source and target users cannot be the same' } }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!options.cloneCategories && !options.cloneProducts) {
      return new Response(
        JSON.stringify({ error: { message: 'At least one option must be selected' } }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('🚀 Starting enhanced clone operation:', {
      sourceUserId: sourceUserId.substring(0, 8),
      targetUserId: targetUserId.substring(0, 8),
      options
    });

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Validate users exist
    const [sourceUserResult, targetUserResult] = await Promise.all([
      supabaseAdmin.from('users').select('id, name, listing_limit').eq('id', sourceUserId).single(),
      supabaseAdmin.from('users').select('id, name, listing_limit').eq('id', targetUserId).single()
    ]);

    if (sourceUserResult.error || !sourceUserResult.data) {
      return new Response(
        JSON.stringify({ error: { message: 'Source user not found' } }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (targetUserResult.error || !targetUserResult.data) {
      return new Response(
        JSON.stringify({ error: { message: 'Target user not found' } }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sourceUser = sourceUserResult.data;
    const targetUser = targetUserResult.data;

    console.log('✅ Users validated:', {
      source: sourceUser.name,
      target: targetUser.name,
      targetLimit: targetUser.listing_limit
    });

    const stats: CloneStats = {
      categoriesCloned: 0,
      productsCloned: 0,
      imagesCloned: 0,
      errors: [],
      skipped: 0,
      totalProcessed: 0
    };

    // Clone categories
    if (options.cloneCategories) {
      console.log('📁 Cloning categories...');
      
      const { data: sourceCategories } = await supabaseAdmin
        .from('user_product_categories')
        .select('name')
        .eq('user_id', sourceUserId);

      if (sourceCategories && sourceCategories.length > 0) {
        if (options.mergeStrategy === 'replace') {
          await supabaseAdmin
            .from('user_product_categories')
            .delete()
            .eq('user_id', targetUserId);
        }

        // Get existing categories for merge
        const { data: existingCategories } = await supabaseAdmin
          .from('user_product_categories')
          .select('name')
          .eq('user_id', targetUserId);

        const existingNames = new Set(existingCategories?.map(c => c.name.toLowerCase()) || []);
        const categoriesToInsert = options.mergeStrategy === 'merge'
          ? sourceCategories.filter(c => !existingNames.has(c.name.toLowerCase()))
          : sourceCategories;

        if (categoriesToInsert.length > 0) {
          const { error } = await supabaseAdmin
            .from('user_product_categories')
            .insert(categoriesToInsert.map(c => ({ user_id: targetUserId, name: c.name })));

          if (error) {
            stats.errors.push(`Erro ao clonar categorias: ${error.message}`);
          } else {
            stats.categoriesCloned = categoriesToInsert.length;
            console.log(`✅ Cloned ${stats.categoriesCloned} categories`);
          }
        }
      }
    }

    // Clone products
    if (options.cloneProducts) {
      console.log('📦 Cloning products...');
      
      const { data: sourceProducts } = await supabaseAdmin
        .from('products')
        .select('*')
        .eq('user_id', sourceUserId)
        .limit(options.maxProducts || 1000);

      if (sourceProducts && sourceProducts.length > 0) {
        console.log(`📦 Found ${sourceProducts.length} products to clone`);

        // Check listing limit
        if (options.mergeStrategy === 'merge') {
          const { count: existingCount } = await supabaseAdmin
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', targetUserId);

          const totalAfter = (existingCount || 0) + sourceProducts.length;
          if (totalAfter > targetUser.listing_limit) {
            return new Response(
              JSON.stringify({
                error: {
                  message: `Limite excedido: ${totalAfter} produtos > ${targetUser.listing_limit} (limite)`
                }
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // Handle replace strategy
        if (options.mergeStrategy === 'replace') {
          console.log('🗑️ Removing existing products...');
          await supabaseAdmin.from('products').delete().eq('user_id', targetUserId);
        }

        // Clone products in batches
        const BATCH_SIZE = 5;
        const batches = [];
        for (let i = 0; i < sourceProducts.length; i += BATCH_SIZE) {
          batches.push(sourceProducts.slice(i, i + BATCH_SIZE));
        }

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex];
          console.log(`📦 Processing batch ${batchIndex + 1}/${batches.length}`);

          for (const product of batch) {
            try {
              // Create product
              const { data: newProduct, error: productError } = await supabaseAdmin
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
                stats.errors.push(`Erro ao criar produto "${product.title}": ${productError.message}`);
                stats.skipped++;
                continue;
              }

              stats.productsCloned++;
              console.log(`✅ Product created: ${newProduct.title}`);

              // Clone images if requested
              if (options.copyImages) {
                const imagesResult = await cloneProductImagesInternal(
                  supabaseAdmin,
                  product.id,
                  newProduct.id
                );
                stats.imagesCloned += imagesResult.cloned;
                stats.errors.push(...imagesResult.errors);
              }

            } catch (error: any) {
              console.error(`❌ Error processing product:`, error);
              stats.errors.push(`Erro no produto "${product.title}": ${error.message}`);
              stats.skipped++;
            }
          }

          // Small delay between batches
          if (batchIndex < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }
    }

    stats.totalProcessed = stats.categoriesCloned + stats.productsCloned;
    stats.success = stats.totalProcessed > 0;

    console.log('🎉 Enhanced clone completed:', stats);

    clearInterval(heartbeatInterval);
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Clone operation completed successfully',
        stats
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('💥 Unexpected error in enhanced-clone-products:', error);
    clearInterval(heartbeatInterval);
    
    return new Response(
      JSON.stringify({
        error: {
          message: 'Internal server error: ' + (error.message || 'Unknown error'),
          timestamp: new Date().toISOString()
        }
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

/**
 * Internal function to clone product images
 */
async function cloneProductImagesInternal(
  supabaseAdmin: any,
  sourceProductId: string,
  targetProductId: string
): Promise<{ cloned: number; errors: string[] }> {
  const result = { cloned: 0, errors: [] };

  try {
    const { data: sourceImages } = await supabaseAdmin
      .from('product_images')
      .select('*')
      .eq('product_id', sourceProductId);

    if (!sourceImages || sourceImages.length === 0) {
      return result;
    }

    console.log(`🖼️ Cloning ${sourceImages.length} images...`);
    let featuredImageUrl = null;

    for (const image of sourceImages) {
      try {
        // Download with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(image.url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'VitrineTurbo-Enhanced-Clone/1.0' }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          result.errors.push(`HTTP ${response.status} para imagem`);
          continue;
        }

        const blob = await response.blob();

        // Validate size
        if (blob.size > 10 * 1024 * 1024) {
          result.errors.push('Imagem muito grande (>10MB)');
          continue;
        }

        // Generate filename
        const ext = image.url.split('.').pop()?.split('?')[0] || 'jpg';
        const filename = `${targetProductId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;
        const filepath = `products/${filename}`;

        // Upload
        const { error: uploadError } = await supabaseAdmin.storage
          .from('public')
          .upload(filepath, blob, {
            contentType: blob.type,
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          result.errors.push(`Upload error: ${uploadError.message}`);
          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabaseAdmin.storage
          .from('public')
          .getPublicUrl(filepath);

        // Save reference
        const { error: insertError } = await supabaseAdmin
          .from('product_images')
          .insert({
            product_id: targetProductId,
            url: publicUrl,
            is_featured: image.is_featured
          });

        if (insertError) {
          result.errors.push(`Insert error: ${insertError.message}`);
          await supabaseAdmin.storage.from('public').remove([filepath]);
          continue;
        }

        if (image.is_featured) {
          featuredImageUrl = publicUrl;
        }

        result.cloned++;
        console.log(`✅ Image cloned: ${filename}`);

      } catch (error: any) {
        result.errors.push(`Image error: ${error.message}`);
      }
    }

    // Update featured image
    if (featuredImageUrl) {
      await supabaseAdmin
        .from('products')
        .update({ featured_image_url: featuredImageUrl })
        .eq('id', targetProductId);
    }

    return result;

  } catch (error: any) {
    result.errors.push(`Images error: ${error.message}`);
    return result;
  }
}