export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import {
  collection, addDoc, query, where, getDocs, doc, getDoc,
  updateDoc, serverTimestamp
} from 'firebase/firestore'

async function writeNotification(payload: {
  agentId: string
  subAgentId: string
  subAgentName: string
  type: string
  referenceId: string
  referenceTitle: string
  customerName: string
  preview: string
}) {
  try {
    await addDoc(collection(db, 'agent_notifications'), {
      ...payload,
      isRead: false,
      createdAt: serverTimestamp(),
    })
  } catch { /* fire-and-forget */ }
}

// GET - fetch bookings for an agent
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')
    const status = searchParams.get('status')

    if (!agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 })
    }

    const bookingsRef = collection(db, 'agent_bookings')
    let q = query(bookingsRef, where('agentId', '==', agentId))

    const snap = await getDocs(q)
    let bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }))

    if (status) {
      bookings = bookings.filter((b: any) => b.status === status)
    }

    return NextResponse.json({ success: true, bookings })
  } catch (error: any) {
    console.error('[Agent Bookings GET] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - submit a new booking (called from agent's branded planner URL)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      agentId,
      agentSlug,
      packageId,
      packageTitle,
      destination,
      customerName,
      customerEmail,
      customerPhone,
      preferredDates,
      groupSize,
      adults,
      kids,
      rooms,
      specialRequests,
      wizardData,
      selectedPackage,
      chatMessages,
      subAgentId,
      bookingValue,
      quotedPrice,
    } = body

    if (!agentId || !customerName) {
      return NextResponse.json(
        { error: 'agentId and customerName are required' },
        { status: 400 }
      )
    }

    const booking = {
      agentId,
      agentSlug: agentSlug || '',
      packageId: packageId || '',
      packageTitle: packageTitle || destination || 'Custom Request',
      destination: destination || '',
      customerName,
      customerEmail,
      customerPhone: customerPhone || '',
      preferredDates: preferredDates || '',
      groupSize: Number(groupSize) || 1,
      adults: Number(adults) || 1,
      kids: Number(kids) || 0,
      rooms: Number(rooms) || 1,
      specialRequests: specialRequests || '',
      wizardData: wizardData || null,
      selectedPackage: selectedPackage || null,
      chatMessages: chatMessages || [],
      subAgentId: subAgentId || null,
      status: 'new',
      bookingValue: bookingValue || null,
      quotedPrice: quotedPrice || null,
      commissionAmount: null,
      adminNotes: '',
      agentNotes: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }

    const docRef = await addDoc(collection(db, 'agent_bookings'), booking)

    // Also upsert customer record for the agent (only when email is available)
    if (customerEmail) {
      await upsertAgentCustomer(agentId, {
        name: customerName,
        email: customerEmail,
        phone: customerPhone || '',
      })
    }

    // Notify DMC when a travel agent's client submits a booking
    if (subAgentId) {
      await writeNotification({
        agentId,
        subAgentId,
        subAgentName: 'Travel Agent',
        type: 'new_booking',
        referenceId: docRef.id,
        referenceTitle: packageTitle || destination || 'Custom Request',
        customerName: customerName || '',
        preview: `New booking for ${packageTitle || destination || 'a trip'} · ${Number(groupSize) || 1} pax`,
      })
    }

    return NextResponse.json({
      success: true,
      bookingId: docRef.id,
      message: 'Booking submitted successfully',
    })
  } catch (error: any) {
    console.error('[Agent Bookings POST] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH - update booking status or notes
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { bookingId, agentId, ...updates } = body

    if (!bookingId) {
      return NextResponse.json({ error: 'bookingId is required' }, { status: 400 })
    }

    const bookingRef = doc(db, 'agent_bookings', bookingId)
    const snap = await getDoc(bookingRef)

    if (!snap.exists()) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    await updateDoc(bookingRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Agent Bookings PATCH] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function upsertAgentCustomer(
  agentId: string,
  customer: { name: string; email: string; phone: string }
) {
  try {
    const customersRef = collection(db, 'agent_customers')
    const q = query(
      customersRef,
      where('agentId', '==', agentId),
      where('email', '==', customer.email)
    )
    const snap = await getDocs(q)

    if (snap.empty) {
      await addDoc(customersRef, {
        agentId,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        totalTrips: 1,
        totalSpend: 0,
        notes: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    } else {
      await updateDoc(snap.docs[0].ref, {
        totalTrips: (snap.docs[0].data().totalTrips || 0) + 1,
        updatedAt: serverTimestamp(),
      })
    }
  } catch (e) {
    console.error('[upsertAgentCustomer] Error:', e)
  }
}
