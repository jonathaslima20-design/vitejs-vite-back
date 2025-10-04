/*
  # Clone User Edge Function

  This function handles complete user cloning with all associated data.
  
  1. Features
    - Validates user authentication and admin permissions
    - Creates new user account with provided credentials
    - Clones all user data: settings, categories, products, images
    - Copies all images from storage to new locations
    - Maintains data integrity and relationships
  
  2. Security
    - Requires authenticated admin user
    - Validates email uniqueness
    - Handles errors gracefully with rollback capability
*/

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only allow POST method
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: { message: 'Method not allowed' } }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get the authorization header
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

    // Create Supabase clients
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
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

    // Get current user and validate permissions
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

    // Check if current user is admin
    const { data: currentUserProfile, error: profileError } = await supabaseUser
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !currentUserProfile || currentUserProfile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: { message: 'Insufficient permissions. Only admins can clone users.' } }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse request body
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

    console.log('Starting user cloning process:', {
      originalUserId,
      newEmail: newUserData.email,
      newName: newUserData.name,
      newSlug: newUserData.slug
    });

    // Step 1: Validate original user exists
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

    // Step 2: Check if new email and slug are unique
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

    // Step 3: Create new user account
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
      // Step 4: Clone user profile
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
          is_blocked: false, // New user starts unblocked
          plan_status: 'inactive', // New user starts with inactive plan
          created_by: user.id, // Mark as created by current admin
          // Don't copy: avatar_url, cover_url_*, promotional_banner_url_* (will be copied separately)
        });

      if (userProfileError) throw userProfileError;

      // Step 5: Copy user images (avatar, covers, banners)
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
            // Download original image
            const imageResponse = await fetch(originalImageUrl);
            if (imageResponse.ok) {
              const imageBlob = await imageResponse.blob();
              
              // Generate new filename
              const originalFileName = originalImageUrl.split('/').pop() || 'image.jpg';
              const fileExtension = originalFileName.split('.').pop() || 'jpg';
              const newFileName = `${newUserId}-${imageConfig.field}-${Date.now()}.${fileExtension}`;
              const newFilePath = `${imageConfig.folder}/${newFileName}`;

              // Upload to new location
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
            // Continue with other images even if one fails
          }
        }
      }

      // Update user with copied images
      if (Object.keys(userImageUpdates).length > 0) {
        await supabaseAdmin
          .from('users')
          .update(userImageUpdates)
          .eq('id', newUserId);
      }

      // Step 6: Clone user storefront settings
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

      // Step 7: Clone user product categories
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

      // Step 8: Clone custom colors
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

      // Step 9: Clone custom sizes
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

      // Step 10: Clone tracking settings
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

      // Step 11: Clone products and their images
      console.log('Cloning products...');
      const { data: products } = await supabaseAdmin
        .from('products')
        .select('*')
        .eq('user_id', originalUserId);

      if (products && products.length > 0) {
        for (const product of products) {
          console.log(`Cloning product: ${product.title}`);
          
          // Create new product (without featured_image_url initially)
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
            continue; // Skip this product but continue with others
          }

          // Clone product images
          const { data: productImages } = await supabaseAdmin
            .from('product_images')
            .select('*')
            .eq('product_id', product.id);

          if (productImages && productImages.length > 0) {
            let newFeaturedImageUrl = null;

            for (const image of productImages) {
              try {
                // Download original image
                const imageResponse = await fetch(image.url);
                if (imageResponse.ok) {
                  const imageBlob = await imageResponse.blob();
                  
                  // Generate new filename
                  const originalFileName = image.url.split('/').pop() || 'image.jpg';
                  const fileExtension = originalFileName.split('.').pop() || 'jpg';
                  const newFileName = `${newProduct.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExtension}`;
                  const newFilePath = `products/${newFileName}`;

                  // Upload to new location
                  const { error: uploadError } = await supabaseAdmin.storage
                    .from('public')
                    .upload(newFilePath, imageBlob);

                  if (!uploadError) {
                    const { data: { publicUrl } } = supabaseAdmin.storage
                      .from('public')
                      .getPublicUrl(newFilePath);

                    // Create new product image record
                    await supabaseAdmin
                      .from('product_images')
                      .insert({
                        product_id: newProduct.id,
                        url: publicUrl,
                        is_featured: image.is_featured
                      });

                    // Track featured image URL
                    if (image.is_featured) {
                      newFeaturedImageUrl = publicUrl;
                    }

                    console.log(`Copied product image successfully: ${newFileName}`);
                  }
                }
              } catch (error) {
                console.warn(`Failed to copy product image:`, error);
                // Continue with other images even if one fails
              }
            }

            // Update product with featured image URL
            if (newFeaturedImageUrl) {
              await supabaseAdmin
                .from('products')
                .update({ featured_image_url: newFeaturedImageUrl })
                .eq('id', newProduct.id);
            }
          }
        }
      }

      // Step 12: Sync categories with storefront settings for new user
      console.log('Syncing categories with storefront settings...');
      // This will be handled automatically by the frontend sync function

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
      
      // Attempt cleanup of created user if something went wrong
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