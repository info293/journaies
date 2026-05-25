export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import {
  collection, query, where, getDocs, doc, updateDoc,
  writeBatch, serverTimestamp, orderBy, limit
} from 'firebase/firestore'

// GET — fetch notifications for a DMC agent
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')
    if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 })

    const q = query(
      collection(db, 'agent_notifications'),
      where('agentId', '==', agentId),
      orderBy('createdAt', 'desc'),
      limit(50)
    )
    const snap = await getDocs(q)
    const notifications = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    const unreadCount = notifications.filter((n: any) => !n.isRead).length

    return NextResponse.json({ success: true, notifications, unreadCount })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH — mark all as read for a DMC agent
export async function PATCH(request: Request) {
  try {
    const { agentId } = await request.json()
    if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 })

    const q = query(
      collection(db, 'agent_notifications'),
      where('agentId', '==', agentId),
      where('isRead', '==', false)
    )
    const snap = await getDocs(q)
    if (snap.empty) return NextResponse.json({ success: true })

    const batch = writeBatch(db)
    snap.docs.forEach(d => batch.update(d.ref, { isRead: true }))
    await batch.commit()

    return NextResponse.json({ success: true, marked: snap.size })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
