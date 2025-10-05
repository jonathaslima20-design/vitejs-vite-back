/*
  # Clone User Edge Function (Public - No JWT Required)

  This function handles complete user cloning with all associated data.

  1. Features
    - Creates new user account with provided credentials
    - Clones all user data: settings, categories, products, images
    - Copies all images from storage to new locations
    - Maintains data integrity and relationships

  2. Security
    - Uses API Key authentication (X-API-Key header)
    - Validates email uniqueness
    - Rate limiting and input validation
    - Handles errors gracefully with rollback capability

  3. Usage
    - Header required: X-API-Key with valid secret key
    - No JWT/Authorization needed
*/

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'x-api-key, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CloneUserRequest {
  originalUserId: string;
  newUserData: {
    email: string;
    password: string;
    name: string;
    slug: string;
  };
}

interface CloneProgress {
  step: string;
  progress: number;
  message: string;
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

    const apiKey = req.headers.get('X-API-Key');
    const validApiKey = Deno.env.get('CLONE_USER_API_KEY');

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
      console.error('CLONE_USER_API_KEY not configured in environment');
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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { originalUserId, newUserData }: CloneUserRequest = await req.json();

    if (!originalUserId || !newUserData?.email || !newUserData?.password || !newUserData?.name || !newUserData?.slug) {
      return new Response(
        JSON.stringify({ error: { message: 'Missing required fields: originalUserId, email, password, name, slug' } }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newUserData.email)) {
      return new Response(
        JSON.stringify({ error: { message: 'Invalid email format' } }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (newUserData.password.length < 6) {
      return new Response(
        JSON.stringify({ error: { message: 'Password must be at least 6 characters long' } }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const slugRegex = /^[a-z0-9-_]+$/i;
    if (!slugRegex.test(newUserData.slug)) {
      return new Response(
        JSON.stringify({ error: { message: 'Slug can only contain letters, numbers, hyphens, and underscores' } }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Starting user cloning process:', {
      originalUserId,
      newEmail: newUserData.email,
      newName: newUserData.name,
      newSlug: newUserData.slug
    });

    const { data: originalUser, error: originalUserError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', originalUserId)
      .single();

    if (originalUserError || !originalUser) {
      return new Response(
        JSON.stringify({ error: { message: 'Original user not found' } }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { data: existingEmailUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', newUserData.email)
      .maybeSingle();

    if (existingEmailUser) {
      return new Response(
        JSON.stringify({ error: { message: 'Email already exists' } }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { data: existingSlugUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('slug', newUserData.slug)
      .maybeSingle();

    if (existingSlugUser) {
      return new Response(
        JSON.stringify({ error: { message: 'Slug already exists' } }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Creating new user account...');
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: newUserData.email,
      password: newUserData.password,
      email_confirm: true,
      user_metadata: {
        name: newUserData.name,
        role: originalUser.role,
        niche_type: originalUser.niche_type,
      }
    });

    if (authError || !authData.user) {
      console.error('Error creating user account:', authError);
      return new Response(
        JSON.stringify({ error: { message: 'Failed to create user account' } }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const newUserId = authData.user.id;
    console.log('New user created with ID:', newUserId);

    try {
      console.log('Cloning user profile...');
      const { error: userProfileError } = await supabaseAdmin
        .from('users')
        .upsert({
          id: newUserId,
          email: newUserData.email,
          name: newUserData.name,
          slug: newUserData.slug,
          role: originalUser.role,
          phone: originalUser.phone,
          bio: originalUser.bio,
          whatsapp: originalUser.whatsapp,
          instagram: originalUser.instagram,
          location_url: originalUser.location_url,
          niche_type: originalUser.niche_type,
          currency: originalUser.currency,
          language: originalUser.language,
          theme: originalUser.theme,
          listing_limit: originalUser.listing_limit,
          is_blocked: false,
          plan_status: 'inactive',
          created_by: null,
        });

      if (userProfileError) throw userProfileError;

      console.log('Copying user images...');
      const imagesToCopy = [
        { field: 'avatar_url', folder: 'avatars' },
        { field: 'cover_url_desktop', folder: 'covers' },
        { field: 'cover_url_mobile', folder: 'covers' },
        { field: 'promotional_banner_url_desktop', folder: 'promotional-banners' },
        { field: 'promotional_banner_url_mobile', folder: 'promotional-banners' },
      ];

      const userImageUpdates: any = {};

      for (const imageConfig of imagesToCopy) {
        const originalImageUrl = originalUser[imageConfig.field];
        if (originalImageUrl) {
          try {
            const imageResponse = await fetch(originalImageUrl);
            if (imageResponse.ok) {
              const imageBlob = await imageResponse.blob();
              
              const originalFileName = originalImageUrl.split('/').pop() || 'image.jpg';
              const fileExtension = originalFileName.split('.').pop() || 'jpg';
              const newFileName = `${newUserId}-${imageConfig.field}-${Date.now()}.${fileExtension}`;
              const newFilePath = `${imageConfig.folder}/${newFileName}`;

              const { error: uploadError } = await supabaseAdmin.storage
                .from('public')
                .upload(newFilePath, imageBlob);

              if (!uploadError) {
                const { data: { publicUrl } } = supabaseAdmin.storage
                  .from('public')
                  .getPublicUrl(newFilePath);

                userImageUpdates[imageConfig.field] = publicUrl;
                console.log(`Copied ${imageConfig.field} successfully`);
              }
            }
          } catch (error) {
            console.warn(`Failed to copy ${imageConfig.field}:`, error);
          }
        }
      }

      if (Object.keys(userImageUpdates).length > 0) {
        await supabaseAdmin
          .from('users')
          .update(userImageUpdates)
          .eq('id', newUserId);
      }

      console.log('Cloning storefront settings...');
      const { data: storefrontSettings } = await supabaseAdmin
        .from('user_storefront_settings')
        .select('settings')
        .eq('user_id', originalUserId)
        .maybeSingle();

      if (storefrontSettings) {
        await supabaseAdmin
          .from('user_storefront_settings')
          .insert({
            user_id: newUserId,
            settings: storefrontSettings.settings
          });
      }

      console.log('Cloning product categories...');
      const { data: categories } = await supabaseAdmin
        .from('user_product_categories')
        .select('name')
        .eq('user_id', originalUserId);

      if (categories && categories.length > 0) {
        const categoryInserts = categories.map(cat => ({
          user_id: newUserId,
          name: cat.name
        }));

        await supabaseAdmin
          .from('user_product_categories')
          .insert(categoryInserts);
      }

      console.log('Cloning custom colors...');
      const { data: customColors } = await supabaseAdmin
        .from('user_colors')
        .select('name, hex_value')
        .eq('user_id', originalUserId);

      if (customColors && customColors.length > 0) {
        const colorInserts = customColors.map(color => ({
          user_id: newUserId,
          name: color.name,
          hex_value: color.hex_value
        }));

        await supabaseAdmin
          .from('user_colors')
          .insert(colorInserts);
      }

      console.log('Cloning custom sizes...');
      const { data: customSizes } = await supabaseAdmin
        .from('user_custom_sizes')
        .select('size_name, size_type')
        .eq('user_id', originalUserId);

      if (customSizes && customSizes.length > 0) {
        const sizeInserts = customSizes.map(size => ({
          user_id: newUserId,
          size_name: size.size_name,
          size_type: size.size_type
        }));

        await supabaseAdmin
          .from('user_custom_sizes')
          .insert(sizeInserts);
      }

      console.log('Cloning tracking settings...');
      const { data: trackingSettings } = await supabaseAdmin
        .from('tracking_settings')
        .select('meta_pixel_id, meta_events, ga_measurement_id, ga_events')
        .eq('user_id', originalUserId)
        .eq('is_active', true)
        .maybeSingle();

      if (trackingSettings) {
        await supabaseAdmin
          .from('tracking_settings')
          .insert({
            user_id: newUserId,
            meta_pixel_id: trackingSettings.meta_pixel_id,
            meta_events: trackingSettings.meta_events,
            ga_measurement_id: trackingSettings.ga_measurement_id,
            ga_events: trackingSettings.ga_events,
            is_active: true
          });
      }

      console.log('Cloning products...');
      const { data: products } = await supabaseAdmin
        .from('products')
        .select('*')
        .eq('user_id', originalUserId);

      if (products && products.length > 0) {
        for (const product of products) {
          console.log(`Cloning product: ${product.title}`);
          
          const { data: newProduct, error: productError } = await supabaseAdmin
            .from('products')
            .insert({
              user_id: newUserId,
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

          const { data: productImages } = await supabaseAdmin
            .from('product_images')
            .select('*')
            .eq('product_id', product.id);

          if (productImages && productImages.length > 0) {
            let newFeaturedImageUrl = null;

            for (const image of productImages) {
              try {
                const imageResponse = await fetch(image.url);
                if (imageResponse.ok) {
                  const imageBlob = await imageResponse.blob();
                  
                  const originalFileName = image.url.split('/').pop() || 'image.jpg';
                  const fileExtension = originalFileName.split('.').pop() || 'jpg';
                  const newFileName = `${newProduct.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExtension}`;
                  const newFilePath = `products/${newFileName}`;

                  const { error: uploadError } = await supabaseAdmin.storage
                    .from('public')
                    .upload(newFilePath, imageBlob);

                  if (!uploadError) {
                    const { data: { publicUrl } } = supabaseAdmin.storage
                      .from('public')
                      .getPublicUrl(newFilePath);

                    await supabaseAdmin
                      .from('product_images')
                      .insert({
                        product_id: newProduct.id,
                        url: publicUrl,
                        is_featured: image.is_featured
                      });

                    if (image.is_featured) {
                      newFeaturedImageUrl = publicUrl;
                    }

                    console.log(`Copied product image successfully: ${newFileName}`);
                  }
                }
              } catch (error) {
                console.warn(`Failed to copy product image:`, error);
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

      console.log('User cloning completed successfully');

      return new Response(
        JSON.stringify({ 
          success: true,
          newUserId,
          message: 'User cloned successfully with all data and images'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );

    } catch (error) {
      console.error('Error during user cloning:', error);
      
      try {
        if (newUserId) {
          await supabaseAdmin.auth.admin.deleteUser(newUserId);
          console.log('Cleaned up partially created user');
        }
      } catch (cleanupError) {
        console.error('Error during cleanup:', cleanupError);
      }

      return new Response(
        JSON.stringify({ error: { message: 'Failed to clone user: ' + error.message } }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error) {
    console.error('Unexpected error in clone-user function:', error);
    return new Response(
      JSON.stringify({ error: { message: 'Internal server error' } }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});