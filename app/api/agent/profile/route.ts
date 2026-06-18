export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { logApiError } from '@/lib/api-logger'

// GET agent by slug — used by customer-facing booking form
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')

    if (!slug) {
      return NextResponse.json({ error: 'slug is required' }, { status: 400 })
    }

    const agentsRef = collection(db, 'agents')
    const q = query(agentsRef, where('agentSlug', '==', slug))
    const snap = await getDocs(q)

    if (snap.empty) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const doc = snap.docs[0]
    const data = doc.data()

    const logoUrl = data.logoUrl || null
    console.log(`[Agent Profile] slug=${slug} logoUrl=${logoUrl ?? 'NOT SET'}`)

    // Return only what the customer-facing page needs
    return NextResponse.json({
      success: true,
      agent: {
        id: doc.id,
        agentSlug: data.agentSlug,
        companyName: data.companyName,
        contactName: data.contactName,
        logoUrl,
        status: data.status,
      },
    })
  } catch (error: any) {
    await logApiError('/api/agent/profile', 'GET', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
