export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { searchSimilarPackages } from '@/lib/pinecone'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || 'Bali'

    try {
        // 💡 Search WITHOUT passing any filter
        const results = await searchSimilarPackages(query, 5, undefined)

        return NextResponse.json({
            message: `Debug Search Results for: "${query}" (NO Filters)`,
            count: results.length,
            // Dump raw metadata to inspect exact keys and values
            results: results.map((r: any) => ({
                id: r.id,
                score: r.score,
                // Inspect specifically these fields
                Destination_Name: r.Destination_Name,
                destinationName: r.destinationName, // check casing
                destination: r.destination, // check casing
                // Dump all keys present in the result object
                allKeys: Object.keys(r)
            }))
        })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
