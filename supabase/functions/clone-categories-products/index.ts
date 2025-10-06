/*
  # Clone Categories and Products Edge Function

  This function handles selective cloning of categories and products between users.
  
  IMPORTANT: This function may take several minutes to complete for users with many products.
  If you encounter timeout errors, increase the Edge Function timeout in Supabase Dashboard:
  1. Go to Edge Functions in your Supabase project
  2. Select 'clone-categories-products' function
  3. Increase timeout to 300+ seconds (5+ minutes)
  4. For very large datasets, consider 600+ seconds (10+ minutes)

  1. Features
    - Validates user authentication and admin permissions
    - Clones categories from user_product_categories table
    - Clones products with all their images
    - Copies all images from storage to new locations
    - Supports merge or replace strategies
    - Maintains data integrity and relationships

  2. Security
    - Requires authenticated admin user
    - Validates source and target users exist
    - Handles errors gracefully with detailed logging
*/

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CloneRequest {
  sourceUserId: string;
  targetUserId: string;
  cloneCategories: boolean;
  cloneProducts: boolean;
  mergeStrategy: 'merge' | 'replace';
}

Deno.serve(async (req: Request) => {
  try {
    console.log('🚀 Clone function started at:', new Date().toISOString());
    
    // Set up heartbeat to prevent timeout
    const heartbeatInterval = setInterval(() => {
      console.log('💓 Heartbeat:', new Date().toISOString());
    }, 30000); // Every 30 seconds
    
    if (req.method === 'OPTIONS') {
      clearInterval(heartbeatInterval);
      return new Response(null, {
        status: 200,
        headers: corsHeaders
      });
    }

    if (req.method !== 'POST') {
      console.error('❌ Invalid method:', req.method);
      clearInterval(heartbeatInterval);
      return new Response(
        JSON.stringify({ error: { message: 'Method not allowed' } }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ Missing authorization header');
      clearInterval(heartbeatInterval);
      return new Response(
        JSON.stringify({ error: { message: 'Missing authorization header' } }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('🔐 Authorization header present, creating clients...');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    console.log('👤 Validating user authentication...');
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('❌ User authentication failed:', userError);
      clearInterval(heartbeatInterval);
      return new Response(
        JSON.stringify({ error: { message: 'Unauthorized' } }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('✅ User authenticated:', user.email);

    const { data: currentUserProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !currentUserProfile || currentUserProfile.role !== 'admin') {
      console.error('❌ Permission check failed:', { profileError, role: currentUserProfile?.role });
      clearInterval(heartbeatInterval);
      return new Response(
        JSON.stringify({ error: { message: 'Insufficient permissions. Only admins can clone data between users.' } }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('✅ Admin permissions verified');

    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('❌ Failed to parse request body:', parseError);
      clearInterval(heartbeatInterval);
      return new Response(
        JSON.stringify({ error: { message: 'Invalid JSON in request body' } }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const {
      sourceUserId,
      targetUserId,
      cloneCategories = true,
      cloneProducts = true,
      mergeStrategy = 'merge'
    }: CloneRequest = requestBody;

    console.log('📋 Request parameters:', {
      sourceUserId: sourceUserId?.substring(0, 8),
      targetUserId: targetUserId?.substring(0, 8),
      cloneCategories,
      cloneProducts,
      mergeStrategy
    });

    if (!sourceUserId || !targetUserId) {
      console.error('❌ Missing required parameters');
      clearInterval(heartbeatInterval);
      return new Response(
        JSON.stringify({ error: { message: 'Missing required fields: sourceUserId, targetUserId' } }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (sourceUserId === targetUserId) {
      console.error('❌ Source and target are the same');
      clearInterval(heartbeatInterval);
      return new Response(
        JSON.stringify({ error: { message: 'Source and target users cannot be the same' } }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!cloneCategories && !cloneProducts) {
      console.error('❌ No clone options selected');
      clearInterval(heartbeatInterval);
      return new Response(
        JSON.stringify({ error: { message: 'At least one option must be selected (categories or products)' } }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('🔍 Validating users exist...');
    
    // Validate users exist with better error handling
    const [sourceUserResult, targetUserResult] = await Promise.allSettled([
      supabaseAdmin.from('users').select('id, name, email').eq('id', sourceUserId).single(),
      supabaseAdmin.from('users').select('id, name, email, listing_limit').eq('id', targetUserId).single()
    ]);

    if (sourceUserResult.status === 'rejected' || !sourceUserResult.value.data) {
      console.error('❌ Source user not found:', sourceUserResult.status === 'rejected' ? sourceUserResult.reason : 'No data');
      clearInterval(heartbeatInterval);
      return new Response(
        JSON.stringify({ error: { message: 'Source user not found' } }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (targetUserResult.status === 'rejected' || !targetUserResult.value.data) {
      console.error('❌ Target user not found:', targetUserResult.status === 'rejected' ? targetUserResult.reason : 'No data');
      clearInterval(heartbeatInterval);
      return new Response(
        JSON.stringify({ error: { message: 'Target user not found' } }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const sourceUser = sourceUserResult.value.data;
    const targetUser = targetUserResult.value.data;

    console.log('✅ Users found:', {
      source: sourceUser.name,
      target: targetUser.name,
      targetLimit: targetUser.listing_limit
    });

    let categoriesCloned = 0;
    let productsCloned = 0;
    let imagesCloned = 0;

    // Add progress tracking
    const startTime = Date.now();

    if (cloneCategories) {
      console.log('📁 Starting category cloning...');

      const { data: sourceCategories } = await supabaseAdmin
        .from('user_product_categories')
        .select('name')
        .eq('user_id', sourceUserId);

      if (sourceCategories && sourceCategories.length > 0) {
        console.log(`📁 Found ${sourceCategories.length} categories to clone`);
        
        if (mergeStrategy === 'replace') {
          console.log('🗑️ Deleting existing categories (replace strategy)...');
          await supabaseAdmin
            .from('user_product_categories')
            .delete()
            .eq('user_id', targetUserId);

          console.log('✅ Existing categories deleted');
        }

        const { data: existingCategories } = await supabaseAdmin
          .from('user_product_categories')
          .select('name')
          .eq('user_id', targetUserId);

        const existingCategoryNames = new Set(
          existingCategories?.map(cat => cat.name.toLowerCase()) || []
        );

        const categoriesToInsert = mergeStrategy === 'merge'
          ? sourceCategories.filter(cat => !existingCategoryNames.has(cat.name.toLowerCase()))
          : sourceCategories;

        console.log(`📁 Categories to insert: ${categoriesToInsert.length}`);

        if (categoriesToInsert.length > 0) {
          const categoryInserts = categoriesToInsert.map(cat => ({
            user_id: targetUserId,
            name: cat.name
          }));

          console.log('💾 Inserting categories...');
          const { error: categoryError } = await supabaseAdmin
            .from('user_product_categories')
            .insert(categoryInserts);

          if (categoryError) {
            console.error('❌ Error cloning categories:', categoryError);
            throw new Error(`Erro ao clonar categorias: ${categoryError.message}`);
          } else {
            categoriesCloned = categoryInserts.length;
            console.log(`✅ Cloned ${categoriesCloned} categories`);
          }
        } else {
          console.log('ℹ️ No new categories to clone (all already exist)');
        }
      } else {
        console.log('ℹ️ No categories found in source user');
      }
    }

    if (cloneProducts) {
      console.log('📦 Starting product cloning...');

      const { data: sourceProducts } = await supabaseAdmin
        .from('products')
        .select('*')
        .eq('user_id', sourceUserId);

      if (sourceProducts && sourceProducts.length > 0) {
        console.log(`📦 Found ${sourceProducts.length} products to clone`);
        
        // Check target user's listing limit
        const { count: existingProductCount } = await supabaseAdmin
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', targetUserId);

        const listingLimit = targetUser.listing_limit || 50;
        const totalAfterClone = (existingProductCount || 0) + (mergeStrategy === 'merge' ? sourceProducts.length : sourceProducts.length);

        console.log('📊 Listing limit check:', {
          existing: existingProductCount,
          toClone: sourceProducts.length,
          totalAfter: totalAfterClone,
          limit: listingLimit
        });

        if (mergeStrategy === 'merge' && totalAfterClone > listingLimit) {
          console.error('❌ Would exceed listing limit');
          clearInterval(heartbeatInterval);
          return new Response(
            JSON.stringify({
              error: {
                message: `Target user would exceed listing limit. Current: ${existingProductCount}, Adding: ${sourceProducts.length}, Limit: ${listingLimit}`
              }
            }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }

        if (mergeStrategy === 'replace' && sourceProducts.length > listingLimit) {
          console.error('❌ Source products exceed target limit');
          clearInterval(heartbeatInterval);
          return new Response(
            JSON.stringify({
              error: {
                message: `Cannot clone ${sourceProducts.length} products. Target user limit is ${listingLimit}`
              }
            }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }

        if (mergeStrategy === 'replace') {
          console.log('🗑️ Deleting existing products (replace strategy)...');
          const { data: existingProducts } = await supabaseAdmin
            .from('products')
            .select('id')
            .eq('user_id', targetUserId);

          if (existingProducts && existingProducts.length > 0) {
            console.log(`🗑️ Deleting ${existingProducts.length} existing products...`);
            await supabaseAdmin
              .from('product_images')
              .delete()
              .in('product_id', existingProducts.map(p => p.id));

            await supabaseAdmin
              .from('products')
              .delete()
              .eq('user_id', targetUserId);

            console.log('✅ Existing products deleted');
          }
        }

        // Process products in smaller batches to avoid timeout
        const BATCH_SIZE = 2; // Process 2 products at a time (further reduced to prevent timeout)
        const batches = [];
        for (let i = 0; i < sourceProducts.length; i += BATCH_SIZE) {
          batches.push(sourceProducts.slice(i, i + BATCH_SIZE));
        }

        console.log(`📦 Processing ${sourceProducts.length} products in ${batches.length} batches of ${BATCH_SIZE}`);

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex];
          console.log(`📦 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} products)`);

          for (const product of batch) {
            const productStartTime = Date.now();
            console.log(`📦 Cloning product: ${product.title}`);

            try {
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
                console.error(`❌ Error creating product "${product.title}":`, productError);
                continue;
              }

              productsCloned++;
              console.log(`✅ Product created: ${newProduct.title}`);

              // Clone product images with enhanced error handling
              const { data: productImages, error: imagesError } = await supabaseAdmin
                .from('product_images')
                .select('*')
                .eq('product_id', product.id);

              if (imagesError) {
                console.error(`❌ Error fetching images for product ${product.id}:`, imagesError);
                continue;
              }

              if (productImages && productImages.length > 0) {
                console.log(`🖼️ Cloning ${productImages.length} images for product: ${product.title}`);
                let newFeaturedImageUrl = null;

                // Process images sequentially to avoid timeout and overwhelming the system
                const IMAGE_CONCURRENCY = 1; // Process one image at a time
                const imagePromises = [];
                
                for (let i = 0; i < productImages.length; i += IMAGE_CONCURRENCY) {
                  const imagesBatch = productImages.slice(i, i + IMAGE_CONCURRENCY);
                  
                  const batchPromises = imagesBatch.map(async (image, batchIndex) => {
                    const imageIndex = i + batchIndex;
                    try {
                      console.log(`🖼️ Processing image ${imageIndex + 1}/${productImages.length}`);
                      
                      // Add timeout and retry for image fetch
                      const controller = new AbortController();
                      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout per image

                      let imageResponse;
                      let retries = 2; // Reduced retries to save time
                      while (retries > 0) {
                        try {
                          imageResponse = await fetch(image.url, {
                            signal: controller.signal,
                            headers: {
                              'User-Agent': 'VitrineTurbo-Clone-Function/1.0'
                            }
                          });
                          if (imageResponse.ok) break;
                          retries--;
                          if (retries > 0) await new Promise(resolve => setTimeout(resolve, 500)); // Reduced retry delay
                        } catch (fetchError) {
                          retries--;
                          if (retries === 0) throw fetchError;
                          await new Promise(resolve => setTimeout(resolve, 500)); // Reduced retry delay
                        }
                      }
                      clearTimeout(timeoutId);

                      if (!imageResponse.ok) {
                        console.warn(`⚠️ Failed to fetch image from ${image.url}: ${imageResponse.status}`);
                        return null;
                      }

                      const contentLength = imageResponse.headers.get('content-length');
                      if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
                        console.warn(`⚠️ Image too large (${contentLength} bytes), skipping`);
                        return null;
                      }

                      const imageBlob = await imageResponse.blob();
                      console.log(`📥 Downloaded image: ${(imageBlob.size / 1024).toFixed(1)}KB`);

                      const originalFileName = image.url.split('/').pop()?.split('?')[0] || 'image.jpg';
                      const fileExtension = originalFileName.split('.').pop() || 'jpg';
                      const timestamp = Date.now();
                      const randomStr = Math.random().toString(36).substring(2, 11);
                      const newFileName = `${newProduct.id}-${timestamp}-${randomStr}.${fileExtension}`;
                      const newFilePath = `products/${newFileName}`;

                      const { error: uploadError } = await supabaseAdmin.storage
                        .from('public')
                        .upload(newFilePath, imageBlob, {
                          contentType: imageBlob.type,
                          cacheControl: '3600',
                          upsert: false
                        });

                      if (uploadError) {
                        console.error(`❌ Failed to upload image: ${uploadError.message}`);
                        return null;
                      }

                      console.log(`📤 Uploaded image to: ${newFilePath}`);

                      const { data: { publicUrl } } = supabaseAdmin.storage
                        .from('public')
                        .getPublicUrl(newFilePath);

                      const { error: insertError } = await supabaseAdmin
                        .from('product_images')
                        .insert({
                          product_id: newProduct.id,
                          url: publicUrl,
                          is_featured: image.is_featured
                        });

                      if (insertError) {
                        console.error(`❌ Failed to insert product image record: ${insertError.message}`);
                        // Try to clean up the uploaded file
                        await supabaseAdmin.storage
                          .from('public')
                          .remove([newFilePath]);
                        return null;
                      }

                      if (image.is_featured) {
                        newFeaturedImageUrl = publicUrl;
                      }

                      console.log(`✅ Image cloned successfully: ${newFileName}`);
                      return { publicUrl, isFeatured: image.is_featured };

                    } catch (error) {
                      console.error(`❌ Failed to copy image ${imageIndex + 1}:`, error);
                      return null;
                    }
                  });
                  
                  imagePromises.push(...batchPromises);
                }

                // Wait for all image operations to complete
                const imageResults = await Promise.allSettled(imagePromises);
                
                // Count successful images and find featured image
                imageResults.forEach((result, index) => {
                  if (result.status === 'fulfilled' && result.value) {
                    imagesCloned++;
                    if (result.value.isFeatured) {
                      newFeaturedImageUrl = result.value.publicUrl;
                    }
                  }
                });

                // Update featured image URL if found
                if (newFeaturedImageUrl) {
                  console.log('🌟 Setting featured image...');
                  await supabaseAdmin
                    .from('products')
                    .update({ featured_image_url: newFeaturedImageUrl })
                    .eq('id', newProduct.id);
                  console.log('✅ Featured image set');
                }

                console.log(`✅ Product "${product.title}" cloned with ${imagesCloned} images`);
              }
              
              const productTime = Date.now() - productStartTime;
              console.log(`⏱️ Product cloned in ${productTime}ms`);
              
            } catch (productError) {
              console.error(`❌ Failed to clone product "${product.title}":`, productError);
              // Continue with next product instead of failing entire operation
            }
          }
          
          // Add small delay between batches to prevent overwhelming the system
          if (batchIndex < batches.length - 1) {
            console.log('⏸️ Pausing between batches...');
            await new Promise(resolve => setTimeout(resolve, 1000)); // Reduced to 1s to save time
          }
        }
      } else {
        console.log('ℹ️ No products found in source user');
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`🎉 Cloning completed successfully in ${totalTime}ms`, {
      categoriesCloned,
      productsCloned,
      imagesCloned
    });

    clearInterval(heartbeatInterval);
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Data cloned successfully',
        stats: {
          categoriesCloned,
          productsCloned,
          imagesCloned
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('💥 Unexpected error in clone-categories-products function:', error);
    
    // Clear heartbeat interval on error
    try {
      clearInterval(heartbeatInterval);
    } catch (e) {
      // Ignore cleanup errors
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    // Log additional context for debugging
    console.error('🔍 Error context:', {
      name: error.name,
      message: error.message,
      stack: error.stack?.substring(0, 500)
    });
    
    // Ensure we always return a proper JSON response
    return new Response(
      JSON.stringify({
        error: {
          message: errorMessage.includes('Internal server error') ? errorMessage : 'Internal server error: ' + errorMessage,
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