// Dynamic Firestore-based destination slug mapper
// Fetches destination slugs from Firestore with in-memory caching

import { collection, getDocs } from 'firebase/firestore'
import { db } from './firebase'

interface PackageReference {
  Destination_Slug?: string
  Destination_Name?: string
  Destination_ID?: string
}

// In-memory cache for destination slugs
let destinationSlugCache: Map<string, string> | null = null
let cacheLoadPromise: Promise<void> | null = null

/**
 * Load destination slugs from Firestore and cache them in memory
 * This runs once per session and caches the results
 */
async function loadDestinationSlugsFromFirestore(): Promise<void> {
  // If already loading, return the existing promise
  if (cacheLoadPromise) {
    return cacheLoadPromise
  }

  // If already loaded, return immediately
  if (destinationSlugCache) {
    return Promise.resolve()
  }

  // Start loading
  cacheLoadPromise = (async () => {
    try {
      destinationSlugCache = new Map<string, string>()

      // Skip if db is not available (SSR or initialization)
      if (typeof window === 'undefined' || !db) {
        console.warn('Firestore not available, using fallback slug mapping')
        return
      }

      const destinationsRef = collection(db, 'destinations')
      const snapshot = await getDocs(destinationsRef)

      snapshot.forEach((doc) => {
        const data = doc.data()
        const slug = data.slug?.toLowerCase()
        const name = data.name?.toLowerCase()

        if (slug && name) {
          // Map destination name to its slug
          destinationSlugCache!.set(name, slug)

          // Also map the slug to itself for direct lookups
          destinationSlugCache!.set(slug, slug)

          // Map common variations (first word, etc.)
          const firstWord = name.split(' ')[0]
          if (firstWord && firstWord !== name) {
            destinationSlugCache!.set(firstWord, slug)
          }
        }
      })

      console.log(`✅ Loaded ${destinationSlugCache!.size} destination slug mappings from Firestore`)
    } catch (error) {
      console.error('Error loading destination slugs from Firestore:', error)
      // Initialize empty cache on error
      destinationSlugCache = new Map()
    }
  })()

  return cacheLoadPromise
}

/**
 * Get destination slug from cache (synchronous lookup after cache is loaded)
 * Falls back to smart extraction if not found in cache
 */
function getSlugFromCache(searchTerm: string): string | null {
  if (!destinationSlugCache) return null

  const lowerTerm = searchTerm.toLowerCase()

  // Direct lookup
  if (destinationSlugCache.has(lowerTerm)) {
    return destinationSlugCache.get(lowerTerm)!
  }

  // Partial match - find any destination that contains this term
  for (const [key, slug] of destinationSlugCache.entries()) {
    if (key.includes(lowerTerm) || lowerTerm.includes(key)) {
      return slug
    }
  }

  return null
}

/**
 * Extracts the destination slug from package data
 * Uses Firestore cache with smart fallbacks
 * 
 * Priority:
 * 1. Use explicit Destination_Slug if available
 * 2. Lookup in Firestore cache (from Destination_ID or Destination_Name)
 * 3. Fallback to extracting and formatting from destination name
 */
export function getDestinationSlugFromPackage(pkg: PackageReference): string {
  // Priority 1: Use explicit Destination_Slug if available
  if (pkg.Destination_Slug) {
    return pkg.Destination_Slug
  }

  // Prepare search strings
  const destName = (pkg.Destination_Name || '').toLowerCase()
  const destId = (pkg.Destination_ID || '').toLowerCase()

  // Priority 2: Try cache lookup
  if (destinationSlugCache) {
    // Try destination name first
    if (destName) {
      const cachedSlug = getSlugFromCache(destName)
      if (cachedSlug) return cachedSlug
    }

    // Try destination ID
    if (destId) {
      const cachedSlug = getSlugFromCache(destId)
      if (cachedSlug) return cachedSlug
    }
  }

  // Priority 3: Fallback - extract first part of destination name and format it
  // Remove country/region info (e.g., "Bali, Indonesia" -> "bali")
  const baseName = destName.split(',')[0].trim()

  // Convert to slug format (lowercase, replace spaces with hyphens)
  const fallbackSlug = baseName.replace(/\s+/g, '-')

  return fallbackSlug || 'destination'
}

/**
 * Get package ID for URL
 * Priority: Slug > Destination_ID > document id > fallback
 */
export function getPackageIdFromPackage(pkg: any): string {
  return pkg.Slug || pkg.Destination_ID || pkg.id || 'package'
}

/**
 * Initialize the destination slug cache
 * Call this early in your app lifecycle (e.g., in a layout component)
 */
export async function initializeDestinationSlugCache(): Promise<void> {
  await loadDestinationSlugsFromFirestore()
}

/**
 * Check if the cache is loaded
 */
export function isDestinationSlugCacheLoaded(): boolean {
  return destinationSlugCache !== null
}

/**
 * Clear the cache (useful for testing or forcing a refresh)
 */
export function clearDestinationSlugCache(): void {
  destinationSlugCache = null
  cacheLoadPromise = null
}
