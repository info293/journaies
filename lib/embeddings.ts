import OpenAI from 'openai'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Generate embedding vector for a text string using OpenAI
 * @param text - The text to embed
 * @returns Array of 1536 numbers representing the text meaning
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
    })
    return response.data[0].embedding
}

/**
 * Format a travel package into searchable text
 * Combines all relevant fields into a single string for embedding
 */
export function formatPackageForEmbedding(pkg: any): string {
    const parts: string[] = []

    // 1. Core Identity
    if (pkg.Destination_Name) parts.push(`Destination: ${pkg.Destination_Name}`)
    if (pkg.Theme) parts.push(`Theme: ${pkg.Theme}`)
    if (pkg.Mood) parts.push(`Mood: ${pkg.Mood}`)
    if (pkg.Occasion) parts.push(`Occasion: ${pkg.Occasion}`)
    if (pkg.Travel_Type) parts.push(`Travel Type: ${pkg.Travel_Type}`)
    if (pkg.Budget_Category) parts.push(`Category: ${pkg.Budget_Category}`)

    // 2. Descriptive Content
    if (pkg.Overview) parts.push(pkg.Overview)

    // 3. Highlights
    if (pkg.Tour_Highlights || pkg.Highlights) {
        const highlights = Array.isArray(pkg.Highlights || pkg.Tour_Highlights)
            ? (pkg.Highlights || pkg.Tour_Highlights).join(', ')
            : (pkg.Highlights || pkg.Tour_Highlights)
        parts.push(`Highlights: ${highlights}`)
    }

    // 4. Inclusions (New)
    if (pkg.Inclusions) {
        const inclusions = Array.isArray(pkg.Inclusions)
            ? pkg.Inclusions.join(', ')
            : pkg.Inclusions
        parts.push(`Inclusions: ${inclusions}`)
    }

    // 5. Exclusions (New - helpful for negative search)
    if (pkg.Exclusions) {
        const exclusions = Array.isArray(pkg.Exclusions)
            ? pkg.Exclusions.join(', ')
            : pkg.Exclusions
        parts.push(`Exclusions: ${exclusions}`)
    }

    // 6. Hotel Info
    if (pkg.Star_Category) parts.push(`Hotel Tier: ${pkg.Star_Category}`)
    if (pkg.Stay_Type) parts.push(`Stay Type: ${pkg.Stay_Type}`)

    // 7. Duration
    if (pkg.Duration) parts.push(`Duration: ${pkg.Duration}`)

    // 8. Condensed Itinerary (Day Titles & Details) - Critical for activity search
    if (pkg.Day_Wise_Itinerary_Details && Array.isArray(pkg.Day_Wise_Itinerary_Details)) {
        const itineraryText = pkg.Day_Wise_Itinerary_Details
            .map((d: any) => `Day ${d.day}: ${d.title}. ${d.description || ''}`)
            .join(' | ')
        parts.push(`Itinerary: ${itineraryText}`)
    } else if (pkg.Day_Wise_Itinerary && Array.isArray(pkg.Day_Wise_Itinerary)) {
        // Fallback for older format
        const itineraryText = pkg.Day_Wise_Itinerary
            .map((d: any) => `Day ${d.day}: ${d.title || d.description}`)
            .join(' | ')
        parts.push(`Itinerary: ${itineraryText}`)
    }

    return parts.join('. ')
}

/**
 * Generate embedding for a travel package
 */
export async function embedPackage(pkg: any): Promise<number[]> {
    const text = formatPackageForEmbedding(pkg)
    return generateEmbedding(text)
}
