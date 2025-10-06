/*
  # Copy Products Public Edge Function (Simplified)

  This function handles copying products and categories between users using API Key authentication.
  Simplified version with essential functionality only.

  1. Features
    - Copies categories and products between users
    - Copies all images to new locations
    - Simple merge strategy (always adds to existing data)
    - Clean error handling

  2. Security
    - Uses API Key authentication (X-API-Key header)
    - Validates users exist
    - Input validation

  3. Usage
    - Header required: X-API-Key with valid secret key
    - Simple request body with source and target user IDs
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

    if (!apiKey || apiKey !== validApiKey) {
      return new Response(
        JSON.stringify({ error: { message: 'Invalid or missing API Key' } }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { sourceUserId, targetUserId }: CopyProductsRequest = await req.json();

    // Validate required fields
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

    console.log('Starting copy process:', { sourceUserId, targetUserId });

    // Validate users exist
    const [sourceUserResult, targetUserResult] = await Promise.all([
      supabaseAdmin.from('users').select('id, name').eq('id', sourceUserId).single(),
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

    let categoriesCloned = 0;
    let productsCloned = 0;
    let imagesCloned = 0;

    // Copy Categories
    console.log('Copying categories...');
    const { data: sourceCategories } = await supabaseAdmin
      .from('user_product_categories')
      .select('name')
      .eq('user_id', sourceUserId);

    if (sourceCategories && sourceCategories.length > 0) {
      // Get existing categories to avoid duplicates
      const { data: existingCategories } = await supabaseAdmin
        .from('user_product_categories')
        .select('name')
        .eq('user_id', targetUserId);

      const existingNames = new Set(existingCategories?.map(c => c.name.toLowerCase()) || []);
      const newCategories = sourceCategories.filter(c => !existingNames.has(c.name.toLowerCase()));

      if (newCategories.length > 0) {
        const { error } = await supabaseAdmin
          .from('user_product_categories')
          .insert(newCategories.map(c => ({ user_id: targetUserId, name: c.name })));

        if (!error) {
          categoriesCloned = newCategories.length;
        }
      }
    }

    // Copy Products
    console.log('Copying products...');
    const { data: sourceProducts } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('user_id', sourceUserId);

    if (sourceProducts && sourceProducts.length > 0) {
      for (const product of sourceProducts) {
        try {
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
            console.error('Error creating product:', productError);
            continue;
          }

          productsCloned++;

          // Copy product images
          const { data: productImages } = await supabaseAdmin
            .from('product_images')
            .select('*')
            .eq('product_id', product.id);

          if (productImages && productImages.length > 0) {
            let featuredImageUrl = null;

            for (const image of productImages) {
              try {
                // Download image
                const imageResponse = await fetch(image.url);
                if (!imageResponse.ok) continue;

                const imageBlob = await imageResponse.blob();
                
                // Generate new filename
                const fileExtension = image.url.split('.').pop() || 'jpg';
                const newFileName = `${newProduct.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExtension}`;
                const newFilePath = `products/${newFileName}`;

                // Upload to storage
                const { error: uploadError } = await supabaseAdmin.storage
                  .from('public')
                  .upload(newFilePath, imageBlob);

                if (uploadError) continue;

                // Get public URL
                const { data: { publicUrl } } = supabaseAdmin.storage
                  .from('public')
                  .getPublicUrl(newFilePath);

                // Save image reference
                const { error: insertError } = await supabaseAdmin
                  .from('product_images')
                  .insert({
                    product_id: newProduct.id,
                    url: publicUrl,
                    is_featured: image.is_featured
                  });

                if (insertError) continue;

                if (image.is_featured) {
                  featuredImageUrl = publicUrl;
                }

                imagesCloned++;

              } catch (error) {
                console.warn('Failed to copy image:', error);
              }
            }

            // Update featured image URL
            if (featuredImageUrl) {
              await supabaseAdmin
                .from('products')
                .update({ featured_image_url: featuredImageUrl })
                .eq('id', newProduct.id);
            }
          }

        } catch (error) {
          console.error('Failed to copy product:', error);
        }
      }
    }

    console.log('Copy completed:', { categoriesCloned, productsCloned, imagesCloned });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Products and categories copied successfully',
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
    console.error('Error in copy-products-public function:', error);
    return new Response(
      JSON.stringify({
        error: { message: 'Internal server error: ' + error.message }
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});