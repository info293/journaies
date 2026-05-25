import { Pinecone } from '@pinecone-database/pinecone'
import { generateEmbedding } from './embeddings'

// Initialize Pinecone client
const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
})

const INDEX_NAME = process.env.PINECONE_INDEX || 'travelzada-packages'

/**
 * Get the Pinecone index for travel packages
 */
export function getIndex() {
    return pinecone.index(INDEX_NAME)
}

/**
 * Package metadata stored in Pinecone
 * Matches the backend schema strictly (Underscore naming)
 */
interface PackageMetadata {
    // Identity
    id: string
    Destination_ID?: string
    Destination_Name: string
    Slug?: string

    // Core Info
    Duration?: string
    Duration_Days?: number
    Price_Range_INR?: string
    Star_Category?: string
    Star_Rating?: number
    Travel_Type?: string
    Mood?: string
    Occasion?: string
    Theme?: string
    Budget_Category?: string
    Adventure_Level?: string

    // Details
    Overview?: string
    Primary_Image_URL?: string
    Image_Alt_Text?: string
    Location_Breakup?: string
    Airport_Code?: string
    Transfer_Type?: string
    Stay_Type?: string
    Meal_Plan?: string
    Rating?: string

    // Suitability
    Child_Friendly?: string
    Elderly_Friendly?: string
    Language_Preference?: string
    Seasonality?: string
    Climate_Type?: string
    Safety_Score?: string
    Sustainability_Score?: string
    Ideal_Traveler_Persona?: string

    // Arrays (Stored as Strings if simple, JSON strings if complex)
    Inclusions?: string[] // List of strings
    Exclusions?: string[] // List of strings
    Highlights?: string[] // List of strings

    // Complex Objects (Must be JSON.stringified for Pinecone)
    Day_Wise_Itinerary?: string // Full text string
    Day_Wise_Itinerary_Details?: string // JSON String
    Guest_Reviews?: string // JSON String
    Booking_Policies?: string // JSON String
    FAQ_Items?: string // JSON String
    Why_Book_With_Us?: string // JSON String

    // SEO
    SEO_Title?: string
    SEO_Description?: string
    SEO_Keywords?: string
}

/**
 * Upsert a single package to Pinecone
 */
export async function upsertPackage(pkg: any, embedding: number[]) {
    const index = getIndex()

    const metadata: PackageMetadata = {
        // Identity
        id: pkg.id || pkg.Destination_ID || '',
        Destination_ID: pkg.Destination_ID || pkg.id || '',
        Destination_Name: pkg.Destination_Name || pkg.destination || '',
        Slug: pkg.Slug || pkg.id || '',

        // Core Info
        Duration: pkg.Duration || pkg.duration || '',
        Duration_Days: pkg.Duration_Days || parseInt((pkg.Duration || pkg.duration || '0').match(/\d+/)?.[0] || '0'),
        Price_Range_INR: pkg.Price_Range_INR || pkg.pricePerPerson || '',
        Star_Category: pkg.Star_Category || pkg.hotelLevel || '',
        Star_Rating: pkg.Star_Rating || parseInt((pkg.Star_Category || pkg.hotelLevel || '0').match(/\d+/)?.[0] || '0'),
        Travel_Type: pkg.Travel_Type || pkg.badge || '',
        Mood: pkg.Mood || '',
        Occasion: pkg.Occasion || '',
        Theme: pkg.Theme || '',
        Budget_Category: pkg.Budget_Category || '',
        Adventure_Level: pkg.Adventure_Level || '',

        // Details
        Overview: pkg.Overview || pkg.overview || '', // Storing FULL overview now
        Primary_Image_URL: pkg.Primary_Image_URL || pkg.image || '',
        Image_Alt_Text: pkg.Image_Alt_Text || pkg.title || '',
        Location_Breakup: pkg.Location_Breakup || pkg.nightsSummary || '',
        Airport_Code: pkg.Airport_Code || '',
        Transfer_Type: pkg.Transfer_Type || '',
        Stay_Type: pkg.Stay_Type || '',
        Meal_Plan: pkg.Meal_Plan || pkg.meals || '',
        Rating: pkg.Rating || (pkg.rating ? pkg.rating.toString() : '') || '',

        // Suitability
        Child_Friendly: pkg.Child_Friendly || '',
        Elderly_Friendly: pkg.Elderly_Friendly || '',
        Language_Preference: pkg.Language_Preference || '',
        Seasonality: pkg.Seasonality || '',
        Climate_Type: pkg.Climate_Type || '',
        Safety_Score: pkg.Safety_Score || '',
        Sustainability_Score: pkg.Sustainability_Score || '',
        Ideal_Traveler_Persona: pkg.Ideal_Traveler_Persona || '',

        // Arrays
        Inclusions: Array.isArray(pkg.Inclusions) ? pkg.Inclusions : (Array.isArray(pkg.inclusions) ? pkg.inclusions : []),
        Exclusions: Array.isArray(pkg.Exclusions) ? pkg.Exclusions : (Array.isArray(pkg.exclusions) ? pkg.exclusions : []),
        Highlights: Array.isArray(pkg.Highlights) ? pkg.Highlights : (Array.isArray(pkg.highlights) ? pkg.highlights : []),

        // Complex Objects (JSON Stringify)
        Day_Wise_Itinerary: typeof pkg.Day_Wise_Itinerary === 'string' ? pkg.Day_Wise_Itinerary : JSON.stringify(pkg.Day_Wise_Itinerary || pkg.itinerary || ''),
        Day_Wise_Itinerary_Details: JSON.stringify(pkg.Day_Wise_Itinerary_Details || []),
        Guest_Reviews: JSON.stringify(pkg.Guest_Reviews || []),
        Booking_Policies: JSON.stringify(pkg.Booking_Policies || pkg.policies || {}),
        FAQ_Items: JSON.stringify(pkg.FAQ_Items || []),
        Why_Book_With_Us: JSON.stringify(pkg.Why_Book_With_Us || []),

        // SEO
        SEO_Title: pkg.SEO_Title || pkg.title || '',
        SEO_Description: pkg.SEO_Description || '',
        SEO_Keywords: pkg.SEO_Keywords || '',
    }

    // Remove undefined/null values as Pinecone hates them
    const cleanMetadata = Object.fromEntries(
        Object.entries(metadata).filter(([_, v]) => v != null && v !== '')
    ) as Record<string, any>;

    await index.upsert({
        records: [
            {
                id: cleanMetadata.id,
                values: embedding,
                metadata: cleanMetadata,
            },
        ]
    })
}

/**
 * Upsert multiple packages to Pinecone in batches
 */
export async function upsertPackages(
    packages: Array<{ pkg: any; embedding: number[] }>
) {
    const index = getIndex()
    const batchSize = 100

    if (!packages || packages.length === 0) {
        console.warn('⚠️ No packages provided to upsertPackages')
        return
    }

    console.log(`📦 Upserting ${packages.length} packages to Pinecone...`)

    for (let i = 0; i < packages.length; i += batchSize) {
        const batch = packages.slice(i, i + batchSize)

        if (batch.length === 0) continue

        const vectors = batch
            .filter(({ embedding }) => embedding && embedding.length > 0)
            .map(({ pkg, embedding }, idx) => {
                const metadata: PackageMetadata = {
                    // Identity
                    id: pkg.id || pkg.Destination_ID || '',
                    Destination_ID: pkg.Destination_ID || pkg.id || '',
                    Destination_Name: pkg.Destination_Name || pkg.destination || '',
                    Slug: pkg.Slug || pkg.id || '',

                    // Core Info
                    Duration: pkg.Duration || pkg.duration || '',
                    Duration_Days: pkg.Duration_Days || Math.max(...(pkg.Duration || pkg.duration || '0').match(/\d+/g)?.map(Number) || [0]),
                    Price_Range_INR: pkg.Price_Range_INR || pkg.pricePerPerson || '',
                    Star_Category: pkg.Star_Category || pkg.hotelLevel || '',
                    Star_Rating: pkg.Star_Rating || parseInt((pkg.Star_Category || pkg.hotelLevel || '0').match(/\d+/)?.[0] || '0'),
                    Travel_Type: pkg.Travel_Type || pkg.badge || '',
                    Mood: pkg.Mood || '',
                    Occasion: pkg.Occasion || '',
                    Theme: pkg.Theme || '',
                    Budget_Category: pkg.Budget_Category || '',
                    Adventure_Level: pkg.Adventure_Level || '',

                    // Details
                    Overview: pkg.Overview || pkg.overview || '',
                    Primary_Image_URL: pkg.Primary_Image_URL || pkg.image || '',
                    Image_Alt_Text: pkg.Image_Alt_Text || pkg.title || '',
                    Location_Breakup: pkg.Location_Breakup || pkg.nightsSummary || '',
                    Airport_Code: pkg.Airport_Code || '',
                    Transfer_Type: pkg.Transfer_Type || '',
                    Stay_Type: pkg.Stay_Type || '',
                    Meal_Plan: pkg.Meal_Plan || pkg.meals || '',
                    Rating: pkg.Rating || (pkg.rating ? pkg.rating.toString() : '') || '',

                    // Suitability
                    Child_Friendly: pkg.Child_Friendly || '',
                    Elderly_Friendly: pkg.Elderly_Friendly || '',
                    Language_Preference: pkg.Language_Preference || '',
                    Seasonality: pkg.Seasonality || '',
                    Climate_Type: pkg.Climate_Type || '',
                    Safety_Score: pkg.Safety_Score || '',
                    Sustainability_Score: pkg.Sustainability_Score || '',
                    Ideal_Traveler_Persona: pkg.Ideal_Traveler_Persona || '',

                    // Arrays
                    Inclusions: Array.isArray(pkg.Inclusions) ? pkg.Inclusions : (Array.isArray(pkg.inclusions) ? pkg.inclusions : []),
                    Exclusions: Array.isArray(pkg.Exclusions) ? pkg.Exclusions : (Array.isArray(pkg.exclusions) ? pkg.exclusions : []),
                    Highlights: Array.isArray(pkg.Highlights) ? pkg.Highlights : (Array.isArray(pkg.highlights) ? pkg.highlights : []),

                    // Complex Objects (JSON Stringify)
                    Day_Wise_Itinerary: typeof pkg.Day_Wise_Itinerary === 'string' ? pkg.Day_Wise_Itinerary : JSON.stringify(pkg.Day_Wise_Itinerary || pkg.itinerary || ''),
                    Day_Wise_Itinerary_Details: JSON.stringify(pkg.Day_Wise_Itinerary_Details || []),
                    Guest_Reviews: JSON.stringify(pkg.Guest_Reviews || []),
                    Booking_Policies: JSON.stringify(pkg.Booking_Policies || pkg.policies || {}),
                    FAQ_Items: JSON.stringify(pkg.FAQ_Items || []),
                    Why_Book_With_Us: JSON.stringify(pkg.Why_Book_With_Us || []),

                    // SEO
                    SEO_Title: pkg.SEO_Title || pkg.title || '',
                    SEO_Description: pkg.SEO_Description || '',
                    SEO_Keywords: pkg.SEO_Keywords || '',
                }

                // Remove undefined/null values
                const cleanMetadata = Object.fromEntries(
                    Object.entries(metadata).filter(([_, v]) => v != null && v !== '')
                ) as Record<string, any>;

                return {
                    id: cleanMetadata.id,
                    values: embedding,
                    metadata: cleanMetadata,
                }
            })

        if (vectors.length === 0) {
            console.warn(`⚠️ Skipped batch ${i} - no valid vectors`)
            continue
        }

        try {
            console.log(`Uploading batch ${i + 1}-${i + vectors.length}...`)
            await index.upsert({ records: vectors })
        } catch (error) {
            console.error(`❌ Error upserting batch starting at ${i}:`, error)
            throw error
        }
    }
}

/**
 * Search for similar packages using semantic search
 */
export async function searchSimilarPackages(
    query: string,
    topK: number = 5,
    filter?: Record<string, any>
): Promise<Array<PackageMetadata & { score: number }>> {
    const index = getIndex()

    // Generate embedding for the search query
    const queryEmbedding = await generateEmbedding(query)

    // 🔧 FILTER TRANSLATION & LOGIC
    // Pinecone Metadata uses Schema keys (Destination_Name, Price_Range_INR)
    const pineconeFilter: any = {}
    let destinationFilter: string | undefined

    if (filter) {
        if (filter.destination) {
            // We store the destination filter for POST-PROCESSING (Soft Match)
            // Pinecone only supports strict equality, which fails on "Bali Relaxing Trip" vs "Bali"
            // So we DO NOT add it to pineconeFilter here.
            destinationFilter = filter.destination
        }

        // Add more mappings as needed
        if (filter.travelType) {
            pineconeFilter.Travel_Type = { '$eq': filter.travelType }
        }

        // Intelligent Duration Filtering (Range)
        if (filter.duration && typeof filter.duration === 'object') {
            const { min, max } = filter.duration
            // Pinecone filtering logic for days
            if (min && max) {
                pineconeFilter.Duration_Days = { '$gte': min, '$lte': max }
            } else if (min) {
                pineconeFilter.Duration_Days = { '$gte': min }
            } else if (max) {
                pineconeFilter.Duration_Days = { '$lte': max }
            }
        }

        // Intelligent Hotel Filtering (Star Rating)
        if (filter.hotel && typeof filter.hotel === 'object') {
            const { minStar } = filter.hotel
            if (minStar) {
                pineconeFilter.Star_Rating = { '$gte': minStar }
            }
        }

        // Note: Budget filtering on string 'Price_Range_INR' is difficult in Pinecone.
        // We rely on the Client-Side Price Filter in ConversationAgent.tsx for strict budget enforcement.
    }

    // Search Pinecone (WITHOUT strict destination filter)
    console.log("🌲 Pinecone Query Filter:", JSON.stringify(pineconeFilter, null, 2))

    const rawResults = await index.query({
        vector: queryEmbedding,
        topK: topK * 10, // Increased fetch to 50 to ensure we get candidates
        includeMetadata: true,
        filter: Object.keys(pineconeFilter).length > 0 ? pineconeFilter : undefined,
    })

    console.log(`🌲 Raw Pinecone Match Count: ${rawResults.matches?.length}`)

    // Transform results & Apply Post-Filtering (Soft Match)
    let finalResults = (
        rawResults.matches?.map((match) => ({
            ...(match.metadata as unknown as PackageMetadata),
            score: match.score || 0,
        })) || []
    )

    // Apply Global Soft Destination Filter (Case-Insensitive Contains ANYWHERE)
    if (destinationFilter) {
        const destLower = destinationFilter.toLowerCase()
        console.log(`🌲 Applying Soft Destination Filter: "${destLower}"`)

        finalResults = finalResults.filter(pkg => {
            // Check ANY of these fields for the destination keyword
            const inName = (pkg.Destination_Name || '').toLowerCase().includes(destLower)
            const inOverview = (pkg.Overview || '').toLowerCase().includes(destLower)
            const inSlug = (pkg.Slug || '').toLowerCase().includes(destLower)

            if (!(inName || inOverview || inSlug)) {
                // Log dropped items occasionally
                // console.log(`Dropped: ${pkg.Destination_Name} (No match for ${destLower})`)
                return false
            }
            return true
        })
        console.log(`🌲 Count After Destination Filter: ${finalResults.length}`)
    }

    // Sort by score and take top K
    return finalResults.sort((a, b) => b.score - a.score).slice(0, topK)
}

/**
 * Delete all vectors from the index (for re-indexing)
 */
export async function deleteAllVectors() {
    const index = getIndex()
    await index.deleteAll()
}

/**
 * Get index statistics
 */
export async function getIndexStats() {
    const index = getIndex()
    return await index.describeIndexStats()
}
