export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'

// GET - fetch a single package
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const snap = await getDoc(doc(db, 'agent_packages', params.id))
    if (!snap.exists()) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, package: { id: snap.id, ...snap.data() } })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - update a package
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { agentId, ...updates } = body

    const pkgRef = doc(db, 'agent_packages', params.id)
    const snap = await getDoc(pkgRef)

    if (!snap.exists()) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 })
    }

    // Verify ownership
    if (snap.data().agentId !== agentId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    await updateDoc(pkgRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - delete a package
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')

    const pkgRef = doc(db, 'agent_packages', params.id)
    const snap = await getDoc(pkgRef)

    if (!snap.exists()) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 })
    }

    if (snap.data().agentId !== agentId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    await deleteDoc(pkgRef)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
