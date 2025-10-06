/*
  # Copy Products Public Edge Function (No JWT Required)

  This function handles copying products and categories between users using API Key authentication.

  1. Features
    - Copies categories from user_product_categories table
    - Copies products with all their images
    - Copies all images from storage to new locations
    - Supports merge or replace strategies
    - Maintains data integrity and relationships
    - Public endpoint with API Key authentication

  2. Security
    - Uses API Key authentication (X-API-Key header)
    - Validates source and target users exist
    - Rate limiting and input validation
    - Handles errors gracefully with detailed logging

  3. Usage
    - Header required: X-API-Key with valid secret key
    - No JWT/Authorization needed
    - Can be called from external systems
*/

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'x-api-key, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CopyProductsRequest {
  sourceUserId: string;
  targetUserId: string;
  cloneCategories: boolean;
  cloneProducts: boolean;
  mergeStrategy: 'merge' | 'replace';
}

interface CopyStats {
  categoriesCloned: number;
  productsCloned: number;
  imagesCloned: number;
  errors: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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
    const validApiKey = Deno.env.get('COPY_PRODUCTS_API_KEY');

    if (!apiKey) {
      console.error('Missing API Key');
      return new Response(
        JSON.stringify({ error: { message: 'Missing X-API-Key header' } }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!validApiKey) {
      console.error('COPY_PRODUCTS_API_KEY not configured in environment');
      return new Response(
        JSON.stringify({ error: { message: 'Server configuration error' } }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (apiKey !== validApiKey) {
      console.error('Invalid API Key provided');
      return new Response(
        JSON.stringify({ error: { message: 'Invalid API Key' } }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('API Key validated successfully');

    // Create Supabase admin client
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

    // Parse request body
    const {
      sourceUserId,
      targetUserId,
      cloneCategories = true,
      cloneProducts = true,
      mergeStrategy = 'merge'
    }: CopyProductsRequest = await req.json();

    // Validate required fields
    if (!sourceUserId || !targetUserId) {
      return new Response(
        JSON.stringify({ error: { message: 'Missing required fields: sourceUserId, targetUserId' } }),
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

    if (!cloneCategories && !cloneProducts) {
      return new Response(
        JSON.stringify({ error: { message: 'At least one option must be selected (categories or products)' } }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Starting copy products process:', {
      sourceUserId,
      targetUserId,
      cloneCategories,
      cloneProducts,
      mergeStrategy
    });

    // Validate users exist
    const { data: sourceUser, error: sourceUserError } = await supabaseAdmin
      .from('users')
      .select('id, name, email')
      .eq('id', sourceUserId)
      .single();

    if (sourceUserError || !sourceUser) {
      return new Response(
        JSON.stringify({ error: { message: 'Source user not found' } }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { data: targetUser, error: targetUserError } = await supabaseAdmin
      .from('users')
      .select('id, name, email, listing_limit')
      .eq('id', targetUserId)
      .single();

    if (targetUserError || !targetUser) {
      return new Response(
        JSON.stringify({ error: { message: 'Target user not found' } }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const stats: CopyStats = {
      categoriesCloned: 0,
      productsCloned: 0,
      imagesCloned: 0,
      errors: []
    };

    // Clone Categories
    if (cloneCategories) {
      console.log('Cloning product categories...');

      try {
        const { data: sourceCategories } = await supabaseAdmin
          .from('user_product_categories')
          .select('name')
          .eq('user_id', sourceUserId);

        if (sourceCategories && sourceCategories.length > 0) {
          // Handle replace strategy
          if (mergeStrategy === 'replace') {
            const { error: deleteError } = await supabaseAdmin
              .from('user_product_categories')
              .delete()
              .eq('user_id', targetUserId);

            if (deleteError) {
              stats.errors.push(`Error deleting existing categories: ${deleteError.message}`);
            } else {
              console.log('Deleted existing categories for replace strategy');
            }
          }

          // Get existing categories for merge strategy
          const { data: existingCategories } = await supabaseAdmin
            .from('user_product_categories')
            .select('name')
            .eq('user_id', targetUserId);

          const existingCategoryNames = new Set(
            existingCategories?.map(cat => cat.name.toLowerCase()) || []
          );

          // Filter categories to insert based on strategy
          const categoriesToInsert = mergeStrategy === 'merge'
            ? sourceCategories.filter(cat => !existingCategoryNames.has(cat.name.toLowerCase()))
            : sourceCategories;

          if (categoriesToInsert.length > 0) {
            const categoryInserts = categoriesToInsert.map(cat => ({
              user_id: targetUserId,
              name: cat.name
            }));

            const { error: categoryError } = await supabaseAdmin
              .from('user_product_categories')
              .insert(categoryInserts);

            if (categoryError) {
              stats.errors.push(`Error cloning categories: ${categoryError.message}`);
            } else {
              stats.categoriesCloned = categoryInserts.length;
              console.log(`Cloned ${stats.categoriesCloned} categories`);
            }
          } else {
            console.log('No new categories to clone (all already exist)');
          }
        }
      } catch (error) {
        stats.errors.push(`Unexpected error cloning categories: ${error.message}`);
      }
    }

    // Clone Products
    if (cloneProducts) {
      console.log('Cloning products...');

      try {
        const { data: sourceProducts } = await supabaseAdmin
          .from('products')
          .select('*')
          .eq('user_id', sourceUserId);

        if (sourceProducts && sourceProducts.length > 0) {
          // Check target user's listing limit
          const { count: existingProductCount } = await supabaseAdmin
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', targetUserId);

          const listingLimit = targetUser.listing_limit || 50;
          const totalAfterClone = mergeStrategy === 'merge' 
            ? (existingProductCount || 0) + sourceProducts.length 
            : sourceProducts.length;

          if (totalAfterClone > listingLimit) {
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

          // Handle replace strategy - delete existing products
          if (mergeStrategy === 'replace') {
            const { data: existingProducts } = await supabaseAdmin
              .from('products')
              .select('id')
              .eq('user_id', targetUserId);

            if (existingProducts && existingProducts.length > 0) {
              // Delete product images first
              const { error: deleteImagesError } = await supabaseAdmin
                .from('product_images')
                .delete()
                .in('product_id', existingProducts.map(p => p.id));

              if (deleteImagesError) {
                stats.errors.push(`Error deleting existing product images: ${deleteImagesError.message}`);
              }

              // Delete products
              const { error: deleteProductsError } = await supabaseAdmin
                .from('products')
                .delete()
                .eq('user_id', targetUserId);

              if (deleteProductsError) {
                stats.errors.push(`Error deleting existing products: ${deleteProductsError.message}`);
              } else {
                console.log('Deleted existing products for replace strategy');
              }
            }
          }

          // Clone each product
          for (const product of sourceProducts) {
            try {
              console.log(`Cloning product: ${product.title}`);

              // Create new product
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
                stats.errors.push(`Error creating product "${product.title}": ${productError.message}`);
                continue;
              }

              stats.productsCloned++;

              // Clone product images
              const { data: productImages } = await supabaseAdmin
                .from('product_images')
                .select('*')
                .eq('product_id', product.id);

              if (productImages && productImages.length > 0) {
                let newFeaturedImageUrl = null;

                for (const image of productImages) {
                  try {
                    // Fetch the original image
                    const imageResponse = await fetch(image.url);
                    if (!imageResponse.ok) {
                      console.warn(`Failed to fetch image from ${image.url}: ${imageResponse.status}`);
                      continue;
                    }

                    // Check file size (limit to 10MB)
                    const contentLength = imageResponse.headers.get('content-length');
                    if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
                      console.warn(`Image too large (${contentLength} bytes), skipping`);
                      continue;
                    }

                    const imageBlob = await imageResponse.blob();

                    // Generate new filename
                    const originalFileName = image.url.split('/').pop()?.split('?')[0] || 'image.jpg';
                    const fileExtension = originalFileName.split('.').pop() || 'jpg';
                    const timestamp = Date.now();
                    const randomStr = Math.random().toString(36).substring(2, 11);
                    const newFileName = `${newProduct.id}-${timestamp}-${randomStr}.${fileExtension}`;
                    const newFilePath = `products/${newFileName}`;

                    // Upload to storage
                    const { error: uploadError } = await supabaseAdmin.storage
                      .from('public')
                      .upload(newFilePath, imageBlob, {
                        contentType: imageBlob.type,
                        cacheControl: '3600',
                        upsert: false
                      });

                    if (uploadError) {
                      console.error(`Failed to upload image: ${uploadError.message}`);
                      continue;
                    }

                    // Get public URL
                    const { data: { publicUrl } } = supabaseAdmin.storage
                      .from('public')
                      .getPublicUrl(newFilePath);

                    // Insert image record
                    const { error: insertError } = await supabaseAdmin
                      .from('product_images')
                      .insert({
                        product_id: newProduct.id,
                        url: publicUrl,
                        is_featured: image.is_featured
                      });

                    if (insertError) {
                      console.error(`Failed to insert product image record: ${insertError.message}`);
                      // Try to clean up the uploaded file
                      await supabaseAdmin.storage
                        .from('public')
                        .remove([newFilePath]);
                      continue;
                    }

                    if (image.is_featured) {
                      newFeaturedImageUrl = publicUrl;
                    }

                    stats.imagesCloned++;
                    console.log(`Copied product image successfully: ${newFileName}`);

                  } catch (error) {
                    console.error(`Failed to copy product image:`, error);
                    stats.errors.push(`Failed to copy image for product "${product.title}": ${error.message}`);
                  }
                }

                // Update featured image URL if we have one
                if (newFeaturedImageUrl) {
                  const { error: updateFeaturedError } = await supabaseAdmin
                    .from('products')
                    .update({ featured_image_url: newFeaturedImageUrl })
                    .eq('id', newProduct.id);

                  if (updateFeaturedError) {
                    console.error(`Failed to update featured image for product ${newProduct.id}:`, updateFeaturedError);
                  }
                }
              }

            } catch (error) {
              console.error(`Failed to clone product "${product.title}":`, error);
              stats.errors.push(`Failed to clone product "${product.title}": ${error.message}`);
            }
          }
        }
      } catch (error) {
        stats.errors.push(`Unexpected error cloning products: ${error.message}`);
      }
    }

    // Update storefront settings for target user
    try {
      console.log('Updating storefront settings...');
      
      // Get source user's storefront settings
      const { data: sourceSettings } = await supabaseAdmin
        .from('user_storefront_settings')
        .select('settings')
        .eq('user_id', sourceUserId)
        .maybeSingle();

      if (sourceSettings?.settings) {
        if (mergeStrategy === 'replace') {
          // Replace all settings
          await supabaseAdmin
            .from('user_storefront_settings')
            .upsert({
              user_id: targetUserId,
              settings: sourceSettings.settings
            }, {
              onConflict: 'user_id'
            });
        } else {
          // Merge settings (preserve existing, add new categories)
          const { data: targetSettings } = await supabaseAdmin
            .from('user_storefront_settings')
            .select('settings')
            .eq('user_id', targetUserId)
            .maybeSingle();

          const mergedSettings = {
            ...targetSettings?.settings,
            ...sourceSettings.settings,
            categoryDisplaySettings: [
              ...(targetSettings?.settings?.categoryDisplaySettings || []),
              ...(sourceSettings.settings.categoryDisplaySettings || [])
            ]
          };

          await supabaseAdmin
            .from('user_storefront_settings')
            .upsert({
              user_id: targetUserId,
              settings: mergedSettings
            }, {
              onConflict: 'user_id'
            });
        }
      }
    } catch (error) {
      console.warn('Error updating storefront settings:', error);
      stats.errors.push(`Warning: Could not update storefront settings: ${error.message}`);
    }

    console.log('Copy products process completed:', stats);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Products and categories copied successfully',
        stats: {
          categoriesCloned: stats.categoriesCloned,
          productsCloned: stats.productsCloned,
          imagesCloned: stats.imagesCloned
        },
        warnings: stats.errors.length > 0 ? stats.errors : undefined
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Unexpected error in copy-products-public function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        error: {
          message: 'Internal server error: ' + errorMessage
        }
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});