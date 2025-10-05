import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

    <!-- Redirect to main app -->
    <meta http-equiv="refresh" content="0;url=${canonicalUrl}" />
    <script>
      window.location.href = "${canonicalUrl}";
    </script>
  </head>
  <body>
    <h1>${profile.name}</h1>
    <p>${description}</p>
    <p>Redirecionando...</p>
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

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const userAgent = req.headers.get('user-agent') || '';

    console.log('🔍 Request received:', {
      url: url.pathname,
      userAgent: userAgent.substring(0, 100),
      isCrawler: isCrawlerUserAgent(userAgent)
    });

    // Only process for crawlers
    if (!isCrawlerUserAgent(userAgent)) {
      console.log('⏩ Not a crawler, passing through');
      return new Response(JSON.stringify({
        message: 'This endpoint is for social media crawlers only',
        userAgent
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }

    // Parse the URL to extract the slug
    // Expected format: /meta-tags-handler?url=https://vitrineturbo.com/kingstore
    const targetUrl = url.searchParams.get('url') || '';
    const urlParts = new URL(targetUrl || 'https://vitrineturbo.com').pathname.split('/').filter(Boolean);

    if (urlParts.length === 0) {
      console.log('📄 Root page, returning default meta tags');
      return new Response(generateDefaultMetaTagsHTML(), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }

    const slug = urlParts[0]; // Get the first path segment as slug

    console.log('🔎 Looking up profile for slug:', slug);

    // Connect to Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Fetch user profile from database
    const profileResponse = await fetch(
      `${supabaseUrl}/rest/v1/users?slug=eq.${slug}&select=name,slug,bio,avatar_url,cover_url_desktop,cover_url_mobile`,
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
      return new Response(generateDefaultMetaTagsHTML(), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }

    const profiles = await profileResponse.json() as UserProfile[];

    if (profiles.length === 0) {
      console.log('⚠️ Profile not found for slug:', slug);
      return new Response(generateDefaultMetaTagsHTML(), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }

    const profile = profiles[0];
    console.log('✅ Profile found:', profile.name);

    // Generate HTML with dynamic meta tags
    const html = generateMetaTagsHTML(profile, targetUrl || `https://vitrineturbo.com/${slug}`);

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=600', // Cache for 5-10 minutes
      },
    });

  } catch (error) {
    console.error('❌ Error processing request:', error);

    return new Response(generateDefaultMetaTagsHTML(), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  }
});
