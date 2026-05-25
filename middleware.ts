import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware to handle SEO for query parameter URLs
 * - Adds noindex header for URLs with ?t= parameter to prevent duplicate indexing
 */
export function middleware(request: NextRequest) {
    // SEO URL Redirects (301 Permanent) - Old URLs → New SEO-optimized URLs
    const seoRedirects: Record<string, string> = {
        '/about-us': '/about',
        '/story': '/our-story',
        '/blog/destination-guide/top-things-to-do-in-bali': '/blog/destination/top-things-to-do-in-bali-a-complete-travel-guide',
        '/destinations/bali-packages/bali-Komodo-6n7d-honeymoon': '/destinations/bali-packages/bali-komodo-6n7d-honeymoon',
        '/destinations/bali-birthday-special/bali-birthday-5n6d-couple': '/destinations/bali-packages/bali-birthday-5n6d-couple',
        '/destinations/anniversary-in-bali/bali-anniversary-6n7d-couple': '/destinations/bali-packages/bali-anniversary-6n7d-couple',
        '/destinations/bali-with-special/bali-anniversary-6n7d-couple': '/destinations/bali-packages/bali-anniversary-6n7d-couple',
        '/destinations/bali-honeymoon-couple-trip/bali-luxury-5n6d-honeymoon': '/destinations/bali-packages/bali-luxury-5n6d-honeymoon',
    }

    if (seoRedirects[request.nextUrl.pathname]) {
        const url = request.nextUrl.clone()
        url.pathname = seoRedirects[request.nextUrl.pathname]
        return NextResponse.redirect(url, 301)
    }

    // WWW vs NON-WWW DUAL SERVING (301 Permanent Redirect)
    const host = request.headers.get('host')
    if (host === 'travelzada.com') {
        const newUrl = request.nextUrl.clone()
        newUrl.host = 'www.travelzada.com'
        newUrl.protocol = 'https:'
        return NextResponse.redirect(newUrl, 301)
    }

    // Dynamic Redirects mapping (e.g. prefix replacements)
    const pathname = request.nextUrl.pathname;
    
    // Fix Kerala Double Hyphen Anomalous URLs
    if (pathname.startsWith('/destinations/kerala--alleppey-thekkady--munnar-packages/')) {
        return NextResponse.redirect(new URL(pathname.replace('/destinations/kerala--alleppey-thekkady--munnar-packages/', '/destinations/kerala-packages/'), request.url), 301)
    }
    if (pathname.startsWith('/destinations/kerala--munnar-thekkady--alleppey-packages/')) {
        return NextResponse.redirect(new URL(pathname.replace('/destinations/kerala--munnar-thekkady--alleppey-packages/', '/destinations/kerala-packages/'), request.url), 301)
    }

    // Fix Blog Category Duplication (Consolidate into single slugs)
    if (pathname.startsWith('/blog/tips/')) {
        return NextResponse.redirect(new URL(pathname.replace('/blog/tips/', '/blog/travel-tips/'), request.url), 301)
    }
    if (pathname.startsWith('/blog/destination-guide/')) {
        return NextResponse.redirect(new URL(pathname.replace('/blog/destination-guide/', '/blog/destination/'), request.url), 301)
    }

    // Pattern A to Pattern B for Tours from City (e.g. /destinations/kashmir/tours/from-delhi -> /destinations/kashmir-packages/tours/from-delhi)
    const tourMatch = pathname.match(/^\/destinations\/([^\/]+)\/tours\/(from-[^\/]+)$/);
    if (tourMatch) {
        const slug = tourMatch[1];
        const routeSlug = tourMatch[2];
        if (!slug.endsWith('-packages')) {
            let baseName = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
            if (baseName === 'andaman') baseName = 'andaman-and-nicobar';
            if (baseName === 'sri') baseName = 'sri-lanka';
            return NextResponse.redirect(new URL(`/destinations/${baseName}-packages/tours/${routeSlug}`, request.url), 301);
        }
    }

    // Clean double hyphens generated in blog slugs
    if (pathname.startsWith('/blog/') && pathname.includes('--')) {
        return NextResponse.redirect(new URL(pathname.replace(/--/g, '-'), request.url), 301)
    }

    // Redirect old AI Planner URL to new URL
    if (pathname === '/ai-planner') {
        return NextResponse.redirect(new URL('/ai-trip-planner', request.url), 301)
    }

    // Check if URL has ?t= parameter (tracking/campaign parameter)
    if (request.nextUrl.searchParams.has('t')) {
        // Return 410 Gone status code for spam pages
        return new NextResponse('Gone', { status: 410 })
    }

    return NextResponse.next()
}

// Apply middleware to all routes except static files and API
export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - api routes (already excluded from robots.txt)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico, images, etc.
         */
        '/((?!api|_next/static|_next/image|favicon.ico|images|.*\\..*).*)'
    ],
}
