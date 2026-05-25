export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import {
  collection, addDoc, query, where, getDocs, serverTimestamp, doc, getDoc
} from 'firebase/firestore'

// GET - fetch all packages for an agent
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')

    if (!agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 })
    }

    // Verify agent exists and is active
    const agentDoc = await getDoc(doc(db, 'agents', agentId))
    if (!agentDoc.exists()) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const packagesRef = collection(db, 'agent_packages')
    const q = query(packagesRef, where('agentId', '==', agentId))
    const snap = await getDocs(q)

    const packages = snap.docs.map(d => ({ id: d.id, ...d.data() }))

    return NextResponse.json({ success: true, packages })
  } catch (error: any) {
    console.error('[Agent Packages GET] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - create a new agent package
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { agentId, ...packageData } = body

    if (!agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 })
    }

    const agentDoc = await getDoc(doc(db, 'agents', agentId))
    if (!agentDoc.exists()) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const agentData = agentDoc.data()

    const newPackage = {
      agentId,
      agentSlug: agentData.agentSlug,
      title: packageData.title || '',
      destination: packageData.destination || '',
      destinationCountry: packageData.destinationCountry || '',
      overview: packageData.overview || '',
      durationDays: Number(packageData.durationDays) || 0,
      durationNights: Number(packageData.durationNights) || 0,
      pricePerPerson: Number(packageData.pricePerPerson) || 0,
      totalPrice: packageData.totalPrice != null ? Number(packageData.totalPrice) : null,
      gst: packageData.gst != null ? Number(packageData.gst) : null,
      currency: packageData.currency || 'INR',
      priceInINR: Number(packageData.priceInINR) || Number(packageData.pricePerPerson) || 0,
      maxGroupSize: Number(packageData.maxGroupSize) || 20,
      minGroupSize: Number(packageData.minGroupSize) || 1,
      travelType: packageData.travelType || 'Leisure',
      theme: packageData.theme || '',
      mood: packageData.mood || '',
      starCategory: packageData.starCategory || '',
      inclusions: packageData.inclusions || [],
      exclusions: packageData.exclusions || [],
      highlights: packageData.highlights || [],
      dayWiseItinerary: packageData.dayWiseItinerary || '',
      hotels: packageData.hotels || [],
      vehicles: packageData.vehicles || [],
      perks: packageData.perks || [],
      primaryImageUrl: packageData.primaryImageUrl || '',
      imageUrls: packageData.imageUrls || [],
      seasonalAvailability: packageData.seasonalAvailability || 'Year Round',
      isActive: true,
      basePackageId: packageData.basePackageId || null,
      markupPercent: Number(packageData.markupPercent) || 0,
      paymentPolicy: packageData.paymentPolicy || '',
      cancellationPolicy: packageData.cancellationPolicy || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }

    const docRef = await addDoc(collection(db, 'agent_packages'), newPackage)

    return NextResponse.json({
      success: true,
      id: docRef.id,
      package: { id: docRef.id, ...newPackage },
    })
  } catch (error: any) {
    console.error('[Agent Packages POST] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
