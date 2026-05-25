export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'

// GET - fetch session events for an agent
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const agentSlug = searchParams.get('agentSlug')
    const subAgentId = searchParams.get('subAgentId')

    if (!agentSlug) {
      return NextResponse.json({ error: 'agentSlug is required' }, { status: 400 })
    }

    let q = query(
      collection(db, 'agent_sessions'),
      where('agentSlug', '==', agentSlug)
    )

    const snap = await getDocs(q)
    let sessions = snap.docs.map(d => ({ id: d.id, ...d.data() }))

    // Filter by subAgentId if provided
    if (subAgentId) {
      sessions = sessions.filter((s: any) => s.subAgentId === subAgentId)
    }

    // Sort by timestamp descending (client-side to avoid composite index)
    sessions.sort((a: any, b: any) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))

    return NextResponse.json({ success: true, sessions })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - create a session event (used by demo loader and wizard)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { agentSlug, action, destination, packageTitle, subAgentId, sessionId } = body

    if (!agentSlug || !action) {
      return NextResponse.json({ error: 'agentSlug and action are required' }, { status: 400 })
    }

    const ref = await addDoc(collection(db, 'agent_sessions'), {
      agentSlug,
      action,
      destination: destination || '',
      packageTitle: packageTitle || '',
      subAgentId: subAgentId || null,
      sessionId: sessionId || `demo-${Date.now()}`,
      timestamp: serverTimestamp(),
    })

    return NextResponse.json({ success: true, id: ref.id })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
