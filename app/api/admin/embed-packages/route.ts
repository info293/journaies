import { NextRequest, NextResponse } from 'next/server'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { embedPackage, formatPackageForEmbedding } from '@/lib/embeddings'
import { upsertPackages, getIndexStats, deleteAllVectors } from '@/lib/pinecone'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for large batch operations

/**
 * POST /api/admin/embed-packages
 * 
 * Fetch all packages from Firestore, generate embeddings, and store in Pinecone.
 * This is an admin-only endpoint that should be called once initially,
 * and then periodically when new packages are added.
 * 
 * Request body (optional):
 * {
 *   "clearExisting": false  // Set to true to clear existing vectors before re-indexing
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "packagesProcessed": 150,
 *   "indexStats": { ... }
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}))
        const { clearExisting = false } = body

        // Check for Pinecone configuration
        if (!process.env.PINECONE_API_KEY) {
            return NextResponse.json(
                { success: false, error: 'Pinecone API key not configured' },
                { status: 500 }
            )
        }

        // Optionally clear existing vectors
        if (clearExisting) {
            console.log('🗑️ Clearing existing vectors...')
            await deleteAllVectors()
        }

        // Fetch all packages from Firestore
        console.log('📦 Fetching packages from Firestore...')
        const packagesRef = collection(db, 'packages')
        const snapshot = await getDocs(packagesRef)

        const packages: any[] = []
        snapshot.forEach((doc) => {
            packages.push({ id: doc.id, ...doc.data() })
        })

        console.log(`Found ${packages.length} packages to embed`)

        if (packages.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No packages found in Firestore',
                packagesProcessed: 0,
            })
        }

        // Generate embeddings for each package
        console.log('🧠 Generating embeddings...')
        const packagesWithEmbeddings: Array<{ pkg: any; embedding: number[] }> = []
        const errors: string[] = []

        for (let i = 0; i < packages.length; i++) {
            const pkg = packages[i]
            try {
                // Format the package text for embedding
                const text = formatPackageForEmbedding(pkg)

                // Skip if no meaningful text to embed
                if (text.length < 20) {
                    console.log(`⚠️ Skipping package ${pkg.id} - insufficient text`)
                    continue
                }

                const embedding = await embedPackage(pkg)
                packagesWithEmbeddings.push({ pkg, embedding })

                // Log progress every 10 packages
                if ((i + 1) % 10 === 0) {
                    console.log(`Embedded ${i + 1}/${packages.length} packages`)
                }
            } catch (error: any) {
                console.error(`Error embedding package ${pkg.id}:`, error.message)
                errors.push(`${pkg.id}: ${error.message}`)
            }
        }

        // Upsert to Pinecone
        console.log('📤 Uploading to Pinecone...')
        await upsertPackages(packagesWithEmbeddings)

        // Get index stats
        const indexStats = await getIndexStats()

        console.log(`✅ Successfully embedded ${packagesWithEmbeddings.length} packages`)

        return NextResponse.json({
            success: true,
            packagesProcessed: packagesWithEmbeddings.length,
            totalPackages: packages.length,
            skipped: packages.length - packagesWithEmbeddings.length,
            errors: errors.length > 0 ? errors : undefined,
            indexStats,
        })
    } catch (error: any) {
        console.error('Embed packages error:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Embedding failed' },
            { status: 500 }
        )
    }
}

/**
 * GET /api/admin/embed-packages
 * 
 * Get current index statistics
 */
export async function GET() {
    try {
        const stats = await getIndexStats()
        return NextResponse.json({ success: true, stats })
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}
