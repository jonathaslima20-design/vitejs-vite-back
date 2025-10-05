import type { Context } from "https://edge.netlify.com";

interface UserProfile {
  name: string;
  slug: string;
  bio?: string;
  avatar_url?: string;
  cover_url_desktop?: string;
  cover_url_mobile?: string;
}

/**
 * Detects if the request is from a social media crawler/bot
 */
function isCrawlerUserAgent(userAgent: string): boolean {
  const crawlerPatterns = [
    'facebookexternalhit',
    'Facebot',
    'Twitterbot',
    'WhatsApp',
    'LinkedInBot',
    'Slackbot',
    'TelegramBot',
    'Discordbot',
    'SkypeUriPreview',
    'MetaInspector',
    'BingPreview',
    'GoogleBot',
    'bingbot',
    'Google-InspectionTool'
  ];

  const ua = userAgent.toLowerCase();
  return crawlerPatterns.some(pattern => ua.includes(pattern.toLowerCase()));
}

/**
 * Generates HTML with dynamic Open Graph meta tags
 */
function generateMetaTagsHTML(profile: UserProfile, requestUrl: string): string {
  const title = `${profile.name} - VitrineTurbo`;
  const description = profile.bio || `Confira os produtos de ${profile.name} na VitrineTurbo`;

  // Prioritize avatar (logo) for storefront preview
  const imageUrl = profile.avatar_url ||
                   profile.cover_url_desktop ||
                   profile.cover_url_mobile ||
                   'https://ikvwygqmlqhsyqmpgaoz.supabase.co/storage/v1/object/public/public/logos/flat-icon-vitrine.png.png';

  const canonicalUrl = requestUrl;

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <!-- Favicon -->
    <link rel="icon" type="image/png" href="${imageUrl}" />
    <link rel="apple-touch-icon" href="${imageUrl}" />

    <!-- Primary Meta Tags -->
    <title>${title}</title>
    <meta name="title" content="${title}" />
    <meta name="description" content="${description}" />

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="profile" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:site_name" content="VitrineTurbo" />

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${canonicalUrl}" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${imageUrl}" />

    <!-- WhatsApp specific -->
    <meta property="og:image:alt" content="${profile.name}" />

    <!-- Redirect to main app for browsers -->
    <meta http-equiv="refresh" content="0;url=${canonicalUrl}" />
    <script>
      // Only redirect actual browsers, not crawlers
      if (!/bot|crawler|spider|crawling/i.test(navigator.userAgent)) {
        window.location.href = "${canonicalUrl}";
      }
    </script>

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  </head>
  <body>
    <div style="font-family: Inter, system-ui, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; text-align: center;">
      <img src="${imageUrl}" alt="${profile.name}" style="width: 150px; height: 150px; border-radius: 50%; object-fit: cover; margin-bottom: 20px;" />
      <h1 style="font-size: 32px; margin-bottom: 10px;">${profile.name}</h1>
      <p style="font-size: 18px; color: #666; margin-bottom: 20px;">${description}</p>
      <p style="color: #999;">Redirecionando...</p>
    </div>
  </body>
</html>`;
}

/**
 * Default meta tags HTML for non-specific pages
 */
function generateDefaultMetaTagsHTML(): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>VitrineTurbo - Sua Vitrine Digital</title>
    <meta name="description" content="VitrineTurbo - Plataforma completa para criar sua vitrine digital profissional" />
    <meta property="og:title" content="VitrineTurbo - Sua Vitrine Digital" />
    <meta property="og:description" content="Plataforma completa para criar sua vitrine digital profissional" />
    <meta property="og:image" content="https://ikvwygqmlqhsyqmpgaoz.supabase.co/storage/v1/object/public/public/logos/flat-icon-vitrine.png.png" />
    <meta property="og:type" content="website" />
  </head>
  <body>
    <h1>VitrineTurbo</h1>
    <p>Sua Vitrine Digital</p>
  </body>
</html>`;
}

export default async (request: Request, context: Context) => {
  const userAgent = request.headers.get('user-agent') || '';
  const url = new URL(request.url);

  console.log('🔍 Edge Function - Request:', {
    path: url.pathname,
    userAgent: userAgent.substring(0, 100),
    isCrawler: isCrawlerUserAgent(userAgent)
  });

  // Only process for crawlers
  if (!isCrawlerUserAgent(userAgent)) {
    console.log('⏩ Not a crawler, passing through to SPA');
    return context.next();
  }

  try {
    // Parse the URL to extract the slug
    const pathSegments = url.pathname.split('/').filter(Boolean);

    // Skip special paths
    if (pathSegments.length === 0 ||
        pathSegments[0] === 'login' ||
        pathSegments[0] === 'register' ||
        pathSegments[0] === 'dashboard' ||
        pathSegments[0] === 'admin' ||
        pathSegments[0] === 'help' ||
        pathSegments[0] === 'assets') {
      console.log('📄 Special path, returning default');
      return new Response(generateDefaultMetaTagsHTML(), {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
        },
      });
    }

    const slug = pathSegments[0];
    console.log('🔎 Looking up profile for slug:', slug);

    // Get Supabase credentials from environment
    const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL') || context.site.env.get('VITE_SUPABASE_URL');
    const supabaseKey = Deno.env.get('VITE_SUPABASE_ANON_KEY') || context.site.env.get('VITE_SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials');
      return context.next();
    }

    // Fetch user profile from database
    const profileResponse = await fetch(
      `${supabaseUrl}/rest/v1/users?slug=eq.${slug}&select=name,slug,bio,avatar_url,cover_url_desktop,cover_url_mobile&limit=1`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!profileResponse.ok) {
      console.error('❌ Database query failed:', profileResponse.status);
      return context.next();
    }

    const profiles = await profileResponse.json() as UserProfile[];

    if (profiles.length === 0) {
      console.log('⚠️ Profile not found for slug:', slug);
      return context.next();
    }

    const profile = profiles[0];
    console.log('✅ Profile found:', profile.name);

    // Generate HTML with dynamic meta tags
    const html = generateMetaTagsHTML(profile, request.url);

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=600',
      },
    });

  } catch (error) {
    console.error('❌ Error processing request:', error);
    return context.next();
  }
};

export const config = {
  path: "/*",
  excludedPath: ["/assets/*", "/api/*"],
};
