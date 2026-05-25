export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'

// GET - list all agents (admin only)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const agentsRef = collection(db, 'agents')
    const snap = await getDocs(agentsRef)
    let agents = snap.docs.map(d => ({ id: d.id, ...d.data() }))

    // Sort newest first client-side (avoids Firestore index requirement)
    agents.sort((a: any, b: any) => {
      const aTime = a.createdAt?.seconds || 0
      const bTime = b.createdAt?.seconds || 0
      return bTime - aTime
    })

    if (status) {
      agents = agents.filter((a: any) => a.status === status)
    }

    // Attach booking counts per agent
    const bookingsSnap = await getDocs(collection(db, 'agent_bookings'))
    const bookingsByAgent: Record<string, number> = {}
    bookingsSnap.docs.forEach(d => {
      const agentId = d.data().agentId
      bookingsByAgent[agentId] = (bookingsByAgent[agentId] || 0) + 1
    })

    agents = agents.map((a: any) => ({
      ...a,
      liveBookings: bookingsByAgent[a.id] || a.totalBookings || 0,
    }))

    return NextResponse.json({ success: true, agents })
  } catch (error: any) {
    console.error('[Admin Agents GET] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
