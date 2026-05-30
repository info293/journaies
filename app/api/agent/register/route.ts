export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import {
  doc, setDoc, getDoc, collection, query, where, getDocs, serverTimestamp
} from 'firebase/firestore'
import { sendMail, buildDmcSignupEmail } from '@/lib/mailer'

// GET /api/agent/register?slug=agentSlug — look up agent by slug (used by tailored-travel page)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')

    if (!slug) {
      return NextResponse.json({ error: 'slug is required' }, { status: 400 })
    }

    const q = query(collection(db, 'agents'), where('agentSlug', '==', slug))
    const snap = await getDocs(q)

    if (snap.empty) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const agentDoc = snap.docs[0]
    const data = agentDoc.data()

    return NextResponse.json({
      agent: {
        id: agentDoc.id,
        agentSlug: data.agentSlug,
        companyName: data.companyName,
        contactName: data.contactName,
        logoUrl: data.logoUrl || null,
        status: data.status,
      }
    })
  } catch (error: any) {
    console.error('[Agent Register GET] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      uid,
      email,
      companyName,
      contactName,
      phone,
      gstNumber,
      agencyType,
      desiredSlug,
    } = body

    if (!uid || !email || !companyName || !contactName || !phone) {
      return NextResponse.json(
        { error: 'Missing required fields: uid, email, companyName, contactName, phone' },
        { status: 400 }
      )
    }

    // Generate slug from company name or desired slug
    let baseSlug = slugify(desiredSlug || companyName)
    if (!baseSlug) baseSlug = 'agent'

    // Ensure slug is unique in agents collection
    let finalSlug = baseSlug
    let suffix = 1
    while (true) {
      const agentsRef = collection(db, 'agents')
      const q = query(agentsRef, where('agentSlug', '==', finalSlug))
      const snap = await getDocs(q)
      if (snap.empty) break
      finalSlug = `${baseSlug}-${suffix++}`
    }

    // Create agent document
    const agentData = {
      uid,
      email,
      agentSlug: finalSlug,
      companyName,
      contactName,
      phone,
      gstNumber: gstNumber || '',
      agencyType: agencyType || 'individual',
      logoUrl: '',
      status: 'pending',
      subscriptionPlan: 'basic',
      commissionRate: 10,
      fallbackToTravelzada: false,
      totalPackages: 0,
      totalBookings: 0,
      totalRevenue: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      adminNotes: '',
    }

    await setDoc(doc(db, 'agents', uid), agentData)

    // Update the user document with agent role and slug
    await setDoc(doc(db, 'users', uid), {
      role: 'agent',
      agentSlug: finalSlug,
      agentStatus: 'pending',
      updatedAt: serverTimestamp(),
    }, { merge: true })

    // Send welcome email — fire and forget
    const dmcMail = buildDmcSignupEmail({ contactName, companyName })
    dmcMail.to = email
    sendMail(dmcMail).catch(() => {})

    return NextResponse.json({
      success: true,
      agentSlug: finalSlug,
      message: 'Registration submitted. Awaiting admin approval.',
    })
  } catch (error: any) {
    console.error('[Agent Register API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Registration failed' },
      { status: 500 }
    )
  }
}
