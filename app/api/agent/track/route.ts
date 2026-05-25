export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'

// POST - track a session event (visit, itinerary_generated, booking_submitted)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      agentSlug,
      sessionId,
      action,
      subAgentId,
      subAgentName,
      destination,
      packageTitle,
      metadata,
    } = body

    if (!agentSlug || !sessionId || !action) {
      return NextResponse.json(
        { error: 'agentSlug, sessionId, and action are required' },
        { status: 400 }
      )
    }

    const validActions = ['visit', 'itinerary_generated', 'booking_submitted']
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const sessionDoc: Record<string, any> = {
      agentSlug,
      sessionId,
      action,
      timestamp: serverTimestamp(),
    }

    if (subAgentId) sessionDoc.subAgentId = subAgentId
    if (subAgentName) sessionDoc.subAgentName = subAgentName
    if (destination) sessionDoc.destination = destination
    if (packageTitle) sessionDoc.packageTitle = packageTitle
    if (metadata) sessionDoc.metadata = metadata

    const docRef = await addDoc(collection(db, 'agent_sessions'), sessionDoc)

    return NextResponse.json({ success: true, id: docRef.id })
  } catch (error: any) {
    console.error('[Track POST] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
