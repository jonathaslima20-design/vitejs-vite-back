/*
  # Clone Categories and Products Edge Function

  This function handles selective cloning of categories and products between users.

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
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders
      });
    }

    if (req.method !== 'POST') {
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
      return new Response(
        JSON.stringify({ error: { message: 'Missing authorization header' } }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

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

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: { message: 'Unauthorized' } }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { data: currentUserProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !currentUserProfile || currentUserProfile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: { message: 'Insufficient permissions. Only admins can clone data between users.' } }),
        {
          status: 403,
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
    }: CloneRequest = await req.json();

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

    console.log('Starting selective cloning process:', {
      sourceUserId,
      targetUserId,
      cloneCategories,
      cloneProducts,
      mergeStrategy
    });

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

    let categoriesCloned = 0;
    let productsCloned = 0;
    let imagesCloned = 0;

    if (cloneCategories) {
      console.log('Cloning product categories...');

      const { data: sourceCategories } = await supabaseAdmin
        .from('user_product_categories')
        .select('name')
        .eq('user_id', sourceUserId);

      if (sourceCategories && sourceCategories.length > 0) {
        if (mergeStrategy === 'replace') {
          await supabaseAdmin
            .from('user_product_categories')
            .delete()
            .eq('user_id', targetUserId);

          console.log('Deleted existing categories for replace strategy');
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

        if (categoriesToInsert.length > 0) {
          const categoryInserts = categoriesToInsert.map(cat => ({
            user_id: targetUserId,
            name: cat.name
          }));

          const { error: categoryError } = await supabaseAdmin
            .from('user_product_categories')
            .insert(categoryInserts);

          if (categoryError) {
            console.error('Error cloning categories:', categoryError);
          } else {
            categoriesCloned = categoryInserts.length;
            console.log(`Cloned ${categoriesCloned} categories`);
          }
        } else {
          console.log('No new categories to clone (all already exist)');
        }
      }
    }

    if (cloneProducts) {
      console.log('Cloning products...');

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
        const totalAfterClone = (existingProductCount || 0) + (mergeStrategy === 'merge' ? sourceProducts.length : sourceProducts.length);

        if (mergeStrategy === 'merge' && totalAfterClone > listingLimit) {
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
          const { data: existingProducts } = await supabaseAdmin
            .from('products')
            .select('id')
            .eq('user_id', targetUserId);

          if (existingProducts && existingProducts.length > 0) {
            await supabaseAdmin
              .from('product_images')
              .delete()
              .in('product_id', existingProducts.map(p => p.id));

            await supabaseAdmin
              .from('products')
              .delete()
              .eq('user_id', targetUserId);

            console.log('Deleted existing products for replace strategy');
          }
        }

        for (const product of sourceProducts) {
          console.log(`Cloning product: ${product.title}`);

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
            console.error('Error creating product:', productError);
            continue;
          }

          productsCloned++;

          const { data: productImages } = await supabaseAdmin
            .from('product_images')
            .select('*')
            .eq('product_id', product.id);

          if (productImages && productImages.length > 0) {
            let newFeaturedImageUrl = null;

            for (const image of productImages) {
              try {
                const imageResponse = await fetch(image.url);
                if (!imageResponse.ok) {
                  console.warn(`Failed to fetch image from ${image.url}: ${imageResponse.status}`);
                  continue;
                }

                const contentLength = imageResponse.headers.get('content-length');
                if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
                  console.warn(`Image too large (${contentLength} bytes), skipping`);
                  continue;
                }

                const imageBlob = await imageResponse.blob();

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
                  console.error(`Failed to upload image: ${uploadError.message}`);
                  continue;
                }

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

                imagesCloned++;
                console.log(`Copied product image successfully: ${newFileName}`);

              } catch (error) {
                console.error(`Failed to copy product image:`, error);
              }
            }

            if (newFeaturedImageUrl) {
              await supabaseAdmin
                .from('products')
                .update({ featured_image_url: newFeaturedImageUrl })
                .eq('id', newProduct.id);
            }
          }
        }
      }
    }

    console.log('Selective cloning completed successfully');

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
    console.error('Unexpected error in clone-categories-products function:', error);
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