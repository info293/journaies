export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import {
  collection, addDoc, query, where, getDocs, getDoc, doc, serverTimestamp
} from 'firebase/firestore'
import { sendMail, buildNewQuotationNotifyDmcEmail } from '@/lib/mailer'

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

// GET /api/agent/quotations?agentId=X  or  ?subAgentId=X
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')
    const subAgentId = searchParams.get('subAgentId')

    if (!agentId && !subAgentId) {
      return NextResponse.json({ error: 'agentId or subAgentId is required' }, { status: 400 })
    }

    const field = agentId ? 'agentId' : 'subAgentId'
    const value = (agentId || subAgentId) as string

    const snap = await getDocs(
      query(collection(db, 'quotations'), where(field, '==', value))
    )

    const quotations = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    quotations.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))

    return NextResponse.json({ success: true, quotations })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function generatePublicId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let id = 'Q-'
  for (let i = 0; i < 5; i++) id += chars[Math.floor(Math.random() * chars.length)]
  return id
}

// POST /api/agent/quotations — travel agent creates a quotation request
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      agentId, agentSlug,
      subAgentId, subAgentName,
      packageId, packageTitle, destination,
      customerName, customerEmail, customerPhone,
      preferredDates, groupSize, adults, kids, infants, rooms,
      specialRequests, wizardData, selectedPackage,
      customPackageData, quotedPrice, agentOwned,
    } = body

    if (!agentId || !subAgentId || !customerName) {
      return NextResponse.json(
        { error: 'agentId, subAgentId, and customerName are required' },
        { status: 400 }
      )
    }

    // Resolve sub-agent name from Firestore if not provided by client
    let resolvedSubAgentName = subAgentName || ''
    if (!resolvedSubAgentName && subAgentId) {
      try {
        const subAgentSnap = await getDoc(doc(db, 'sub_agents', subAgentId))
        if (subAgentSnap.exists()) {
          resolvedSubAgentName = subAgentSnap.data().name || ''
        }
      } catch { /* non-fatal */ }
      // Fallback: the subAgentId may be a DMC's own agent ID (self-generated via ?subAgent= URL param)
      if (!resolvedSubAgentName) {
        try {
          const agentSnap = await getDoc(doc(db, 'agents', subAgentId))
          if (agentSnap.exists()) {
            resolvedSubAgentName = agentSnap.data().companyName || agentSnap.data().contactName || ''
          }
        } catch { /* non-fatal */ }
      }
    }

    const quotation = {
      publicId: generatePublicId(),
      agentId,
      agentSlug: agentSlug || '',
      subAgentId,
      subAgentName: resolvedSubAgentName,
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
      infants: Number(infants) || 0,
      rooms: Number(rooms) || 1,
      specialRequests: specialRequests || '',
      wizardData: wizardData || null,
      selectedPackage: selectedPackage || null,
      customPackageData: customPackageData || null,
      agentOwned: agentOwned || false,
      status: 'pending',
      quotedPrice: quotedPrice ?? null,
      agentNotes: '',
      subAgentNotes: '',
      messages: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }

    const ref = await addDoc(collection(db, 'quotations'), quotation)

    // Notify DMC of new quotation request from travel agent
    await writeNotification({
      agentId,
      subAgentId,
      subAgentName: resolvedSubAgentName || 'Travel Agent',
      type: 'new_quotation',
      referenceId: ref.id,
      referenceTitle: packageTitle || destination || 'Custom Request',
      customerName: customerName || '',
      preview: `New quotation request for ${packageTitle || destination || 'a trip'} · ${Number(groupSize) || 1} pax${preferredDates ? ` · ${preferredDates}` : ''}`,
    })

    // Email DMC — fire and forget
    getDoc(doc(db, 'agents', agentId)).then(agentSnap => {
      if (!agentSnap.exists()) return
      const agent = agentSnap.data()
      const pkgLabel = packageTitle || destination || 'a trip'
      const paxLabel = `${Number(adults) || 1} adult${(Number(adults) || 1) !== 1 ? 's' : ''}${Number(kids) > 0 ? `, ${kids} kid${Number(kids) !== 1 ? 's' : ''}` : ''}`
      const mail = buildNewQuotationNotifyDmcEmail({
        dmcName: agent.contactName || agent.companyName || 'there',
        companyName: agent.companyName || '',
        subAgentName: resolvedSubAgentName || 'A travel agent',
        customerName,
        packageTitle: pkgLabel,
        paxLabel,
        rooms: Number(rooms) || 1,
        preferredDates: preferredDates || undefined,
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.travelzada.com'}/dmc-dashboard`,
      })
      mail.to = agent.email
      sendMail(mail).catch(() => {})
    }).catch(() => {})

    return NextResponse.json({ success: true, quotationId: ref.id, publicId: quotation.publicId })
  } catch (error: any) {
    console.error('[Quotations POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
