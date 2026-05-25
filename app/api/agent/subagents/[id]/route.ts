export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'

// GET - fetch a single sub-agent's profile
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const snap = await getDoc(doc(db, 'sub_agents', id))
    if (!snap.exists()) {
      return NextResponse.json({ error: 'Sub-agent not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, subAgent: { id: snap.id, ...snap.data() } })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH - update sub-agent (suspend/reactivate/update details)
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const body = await request.json()
    const { isActive, name, phone, logoUrl } = body

    const subAgentRef = doc(db, 'sub_agents', id)
    const snap = await getDoc(subAgentRef)

    if (!snap.exists()) {
      return NextResponse.json({ error: 'Sub-agent not found' }, { status: 404 })
    }

    const updates: Record<string, any> = { updatedAt: serverTimestamp() }
    if (typeof isActive === 'boolean') updates.isActive = isActive
    if (name !== undefined) updates.name = name
    if (phone !== undefined) updates.phone = phone
    if (logoUrl !== undefined) updates.logoUrl = logoUrl

    await updateDoc(subAgentRef, updates)

    // Sync to users document
    const userRef = doc(db, 'users', id)
    const userSnap = await getDoc(userRef)
    if (userSnap.exists()) {
      const userUpdates: Record<string, any> = {}
      if (typeof isActive === 'boolean') {
        userUpdates.isActive = isActive
        userUpdates.agentStatus = isActive ? 'active' : (body.status === 'pending' ? 'pending' : 'suspended')
      }
      if (body.status) userUpdates.agentStatus = body.status
      if (name !== undefined) userUpdates.displayName = name
      if (Object.keys(userUpdates).length > 0) {
        await updateDoc(userRef, userUpdates)
      }
    }

    // Send approval email when DMC approves a self-registered travel agent
    if (body.approve === true) {
      const subSnap = await getDoc(subAgentRef)
      const subData = subSnap.data()
      const agentSnap = await getDoc(doc(db, 'agents', subData?.agentId))
      const agentData = agentSnap.data()
      const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://www.travelzada.com'
      fetch(`${BASE}/api/email/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'travel_agent_approved',
          data: {
            name: subData?.name,
            email: subData?.email,
            agentCompanyName: agentData?.companyName,
            plannerUrl: `${BASE}/tailored-travel/${agentData?.agentSlug}`,
          },
        }),
      }).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - remove sub-agent record (does not delete Firebase Auth user)
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params

    const subAgentRef = doc(db, 'sub_agents', id)
    const snap = await getDoc(subAgentRef)

    if (!snap.exists()) {
      return NextResponse.json({ error: 'Sub-agent not found' }, { status: 404 })
    }

    await deleteDoc(subAgentRef)

    // Deactivate user doc instead of deleting (preserve audit trail)
    const userRef = doc(db, 'users', id)
    const userSnap = await getDoc(userRef)
    if (userSnap.exists()) {
      await updateDoc(userRef, {
        isActive: false,
        agentStatus: 'removed',
        role: 'user',
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
