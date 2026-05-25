export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, addDoc, doc, getDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore'
import { v4 as uuidv4 } from 'uuid'
import { sendMail, buildMessageToAgentEmail, buildMessageToDmcEmail } from '@/lib/mailer'

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

// GET a single quotation with all messages
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const snap = await getDoc(doc(db, 'quotations', params.id))
    if (!snap.exists()) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, quotation: { id: snap.id, ...snap.data() } })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH — update status/price OR add a message
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { action, ...rest } = body

    const ref = doc(db, 'quotations', params.id)
    const snap = await getDoc(ref)
    if (!snap.exists()) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
    }

    const quotData = snap.data()!

    if (action === 'message') {
      // Add a message to the messages array
      const { senderId, senderRole, senderName, text } = rest
      if (!senderId || !text) {
        return NextResponse.json({ error: 'senderId and text are required' }, { status: 400 })
      }

      const message = {
        id: uuidv4(),
        senderId,
        senderRole,
        senderName: senderName || '',
        text,
        timestamp: new Date().toISOString(),
      }

      await updateDoc(ref, {
        messages: arrayUnion(message),
        status: quotData.status === 'pending' ? 'in_discussion' : quotData.status,
        updatedAt: serverTimestamp(),
      })

      const preview = text.length > 200 ? text.slice(0, 197) + '…' : text
      const quotTitle = quotData.packageTitle || quotData.destination || 'Quotation'
      const customerName = quotData.customerName || ''
      const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.travelzada.com'

      // ── Travel Agent → notify DMC via in-app + email ─────────────────────
      if (senderRole !== 'dmc' && quotData.agentId) {
        await writeNotification({
          agentId: quotData.agentId,
          subAgentId: senderId,
          subAgentName: senderName || 'Travel Agent',
          type: 'quotation_message',
          referenceId: params.id,
          referenceTitle: quotTitle,
          customerName,
          preview,
        })

        // Look up DMC email from users collection (fire-and-forget)
        ;(async () => {
          try {
            const dmcSnap = await getDoc(doc(db, 'users', quotData.agentId))
            const dmcEmail = dmcSnap.data()?.email as string | undefined
            const dmcName  = (dmcSnap.data()?.displayName || dmcSnap.data()?.contactName || 'there') as string
            if (dmcEmail) {
              const mail = buildMessageToDmcEmail({
                dmcContactName: dmcName,
                senderName: senderName || 'Travel Agent',
                quotationTitle: quotTitle,
                customerName,
                messagePreview: preview,
                dashboardUrl: `${APP_URL}/dmc-dashboard`,
              })
              mail.to = dmcEmail
              await sendMail(mail)
            }
          } catch { /* never block the response */ }
        })()
      }

      // ── DMC → notify Travel Agent via email ───────────────────────────────
      if (senderRole === 'dmc' && quotData.subAgentId) {
        ;(async () => {
          try {
            const agentSnap = await getDoc(doc(db, 'users', quotData.subAgentId))
            const agentEmail = agentSnap.data()?.email as string | undefined
            const agentName  = (agentSnap.data()?.displayName || agentSnap.data()?.name || 'there') as string
            if (agentEmail) {
              const mail = buildMessageToAgentEmail({
                agentName,
                senderName: senderName || 'Your DMC',
                quotationTitle: quotTitle,
                customerName,
                messagePreview: preview,
                dashboardUrl: `${APP_URL}/travel-agent-dashboard`,
              })
              mail.to = agentEmail
              await sendMail(mail)
            }
          } catch { /* never block the response */ }
        })()
      }

      return NextResponse.json({ success: true, message })
    }

    // Generic field update (status, quotedPrice, agentNotes, subAgentNotes, etc.)
    const updates: Record<string, any> = { updatedAt: serverTimestamp() }
    const allowed = ['status', 'quotedPrice', 'agentNotes', 'subAgentNotes', 'customPackageData']
    allowed.forEach(f => { if (rest[f] !== undefined) updates[f] = rest[f] })

    // Notify DMC when a travel agent changes status or price
    const { requesterId, requesterRole, requesterName } = rest
    if (requesterRole !== 'dmc' && requesterId && quotData.agentId) {
      if (updates.status) {
        const statusLabels: Record<string, string> = {
          accepted: 'accepted the quotation',
          rejected: 'rejected the quotation',
          in_discussion: 'started a discussion',
        }
        await writeNotification({
          agentId: quotData.agentId,
          subAgentId: requesterId,
          subAgentName: requesterName || 'Travel Agent',
          type: 'quotation_status',
          referenceId: params.id,
          referenceTitle: quotData.packageTitle || quotData.destination || 'Quotation',
          customerName: quotData.customerName || '',
          preview: statusLabels[updates.status] || `changed status to ${updates.status}`,
        })
      }
      if (updates.quotedPrice) {
        await writeNotification({
          agentId: quotData.agentId,
          subAgentId: requesterId,
          subAgentName: requesterName || 'Travel Agent',
          type: 'price_update',
          referenceId: params.id,
          referenceTitle: quotData.packageTitle || quotData.destination || 'Quotation',
          customerName: quotData.customerName || '',
          preview: `Proposed price ₹${Number(updates.quotedPrice).toLocaleString('en-IN')} for ${quotData.customerName}`,
        })
      }
    }

    await updateDoc(ref, updates)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Quotation PATCH]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
