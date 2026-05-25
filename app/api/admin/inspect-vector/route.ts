import { NextRequest, NextResponse } from 'next/server'
import { getIndex } from '@/lib/pinecone'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/inspect-vector?id=PACKAGE_ID
 * 
 * Retrieves the RAW vector and metadata from Pinecone for a specific package.
 * Use this to verify that your data (Inclusions, Itinerary, etc.) is actually saved.
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'Missing "id" query parameter' },
                { status: 400 }
            )
        }

        const index = getIndex()

        // Fetch the vector by ID
        // Passing ids via object { ids: [id] } as per modern Pinecone SDK
        const result = await index.fetch({ ids: [id] })

        // Handle different Pinecone SDK versions (records vs vectors)
        const records = result.records || (result as any).vectors
        const vector = records ? records[id] : null

        if (!vector) {
            return NextResponse.json({
                success: false,
                message: 'Vector not found in Pinecone',
                id
            }, { status: 404 })
        }

        return NextResponse.json({
            success: true,
            id,
            // We return the full metadata to visually inspect
            metadata: vector.metadata,
            // We verify the vector exists (but don't dump 1536 numbers unless asked)
            vectorLength: vector.values ? vector.values.length : 0,
        })

    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}
