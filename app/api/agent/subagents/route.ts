export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import {
  collection, query, where, getDocs,
  doc, getDoc, setDoc, addDoc, serverTimestamp
} from 'firebase/firestore'

// GET - list all travel agents for an agent (optionally filter by status)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')

    if (!agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 })
    }

    const q = query(collection(db, 'sub_agents'), where('agentId', '==', agentId))
    const snap = await getDocs(q)
    const subAgents = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    subAgents.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))

    return NextResponse.json({ success: true, subAgents })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - create OR self-register a travel agent
// If `selfRegister: true` → status starts as 'pending', DMC must approve
// Otherwise (DMC creating directly) → status is 'active'
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { agentId, agentSlug: bodyAgentSlug, name, email, password, phone, organization, selfRegister } = body

    if (!agentId || !name || !email || !password) {
      return NextResponse.json(
        { error: 'agentId, name, email, and password are required' },
        { status: 400 }
      )
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    }

    // Verify parent agent
    const agentSnap = await getDoc(doc(db, 'agents', agentId))
    if (!agentSnap.exists()) {
      return NextResponse.json({ error: 'Parent agent not found' }, { status: 404 })
    }
    const agentData = agentSnap.data()

    // Create Firebase Auth user via REST API
    const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyDFMs2l-0OlMBAJS-XjcXM9oHX3uRNRE5E'
    const authRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: false }),
      }
    )

    const authData = await authRes.json()
    if (!authRes.ok || authData.error) {
      const msg = authData.error?.message || 'Failed to create account'
      if (msg === 'EMAIL_EXISTS') {
        return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
      }
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const uid: string = authData.localId
    const status = selfRegister ? 'pending' : 'active'
    const isActive = !selfRegister

    // users/{uid}
    await setDoc(doc(db, 'users', uid), {
      email,
      displayName: name,
      role: 'subagent',
      agentId,
      parentAgentSlug: agentData.agentSlug,
      agentStatus: status,
      isActive,
      createdAt: serverTimestamp(),
      permissions: [],
    })

    // sub_agents/{uid}
    const subAgentDoc = {
      agentId,
      agentSlug: agentData.agentSlug,
      name,
      email,
      phone: phone || '',
      organization: organization || '',
      status,   // 'pending' | 'active' | 'suspended'
      isActive,
      totalBookings: 0,
      totalRevenue: 0,
      selfRegistered: !!selfRegister,
      createdAt: serverTimestamp(),
      createdBy: selfRegister ? uid : agentId,
    }
    await setDoc(doc(db, 'sub_agents', uid), subAgentDoc)

    // ── Send acknowledgement emails + in-app notification ───────────────
    const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://www.travelzada.com'
    if (selfRegister) {
      // Email to travel agent
      fetch(`${BASE}/api/email/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'travel_agent_signup',
          data: { name, email, agentCompanyName: agentData.companyName },
        }),
      }).catch(() => {})

      // Email to DMC
      fetch(`${BASE}/api/email/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'travel_agent_signup_notify_dmc',
          data: {
            agentEmail: agentData.email,
            agentCompanyName: agentData.companyName,
            travelAgentName: name,
            travelAgentEmail: email,
          },
        }),
      }).catch(() => {})

      // In-app notification for DMC
      addDoc(collection(db, 'agent_notifications'), {
        agentId,
        type: 'new_travel_agent',
        travelAgentName: name,
        travelAgentEmail: email,
        travelAgentOrganization: organization || '',
        preview: `${name} has requested to join your team${organization ? ` from ${organization}` : ''}.`,
        isRead: false,
        createdAt: serverTimestamp(),
      }).catch(() => {})
    }

    return NextResponse.json({ success: true, subAgent: { id: uid, ...subAgentDoc }, status })
  } catch (error: any) {
    console.error('[TravelAgent POST] Error:', error)
    return NextResponse.json({ error: error.message || 'Failed to create travel agent' }, { status: 500 })
  }
}
