'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import TailoredItineraryWizard from './TailoredItineraryWizard'
import AgentLoginGate from './AgentLoginGate'
import { useAuth } from '@/contexts/AuthContext'
import { v4 as uuidv4 } from 'uuid'

interface AgentInfo {
  id: string
  companyName: string
  contactName: string
  agentSlug: string
  logoUrl?: string | null
  fallbackToTravelzada: boolean
}

interface Props {
  agent: AgentInfo
}

function getOrCreateSessionId(agentSlug: string): string {
  if (typeof window === 'undefined') return uuidv4()
  const key = `session_${agentSlug}`
  let sid = sessionStorage.getItem(key)
  if (!sid) {
    sid = uuidv4()
    sessionStorage.setItem(key, sid)
  }
  return sid
}

async function trackEvent(payload: {
  agentSlug: string
  sessionId: string
  action: string
  subAgentId?: string
  subAgentName?: string
}) {
  try {
    await fetch('/api/agent/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (e) {
    // fire-and-forget, ignore errors
  }
}

export default function AgentBrandedWizard({ agent }: Props) {
  const { isAgent, agentSlug, isSubAgent, parentAgentSlug, subAgentName, currentUser, loading } = useAuth()
  const searchParams = useSearchParams()
  const isEmbed = searchParams.get('embed') === '1'
  const subAgentParam = searchParams.get('subAgent') ?? undefined
  const [gateVisible, setGateVisible] = useState(!isEmbed)
  const [sessionId, setSessionId] = useState<string>('')
  const [subAgentId, setSubAgentId] = useState<string | undefined>(subAgentParam)

  useEffect(() => {
    const sid = getOrCreateSessionId(agent.agentSlug)
    setSessionId(sid)

    // DMC opened planner via ?subAgent= param — skip gate and use the passed ID
    if (subAgentParam) {
      setSubAgentId(subAgentParam)
      setGateVisible(false)
      trackEvent({ agentSlug: agent.agentSlug, sessionId: sid, action: 'visit', subAgentId: subAgentParam })
      return
    }

    if (!loading && currentUser) {
      // Skip gate for the agent who owns this planner
      if (isAgent && agentSlug === agent.agentSlug) {
        setGateVisible(false)
        trackEvent({ agentSlug: agent.agentSlug, sessionId: sid, action: 'visit', subAgentId: currentUser.uid })
      }
      // Skip gate for sub-agents of this agency
      else if (isSubAgent && parentAgentSlug === agent.agentSlug) {
        setSubAgentId(currentUser.uid)
        setGateVisible(false)
        trackEvent({
          agentSlug: agent.agentSlug,
          sessionId: sid,
          action: 'visit',
          subAgentId: currentUser.uid,
          subAgentName: subAgentName || undefined,
        })
      }
    }
  }, [loading, isAgent, agentSlug, isSubAgent, parentAgentSlug, currentUser, agent.agentSlug, subAgentName, subAgentParam])

  const handleLoginSuccess = () => {
    setGateVisible(false)
    if (currentUser && isSubAgent && parentAgentSlug === agent.agentSlug) {
      setSubAgentId(currentUser.uid)
      trackEvent({
        agentSlug: agent.agentSlug,
        sessionId,
        action: 'visit',
        subAgentId: currentUser.uid,
        subAgentName: subAgentName || undefined,
      })
    }
  }

  return (
    <main className="min-h-screen flex flex-col relative overflow-x-hidden bg-gray-50">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none -z-10">
        <img
          src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?q=80&w=2070&auto=format&fit=crop"
          alt="Travel planning background"
          className="absolute inset-0 w-full h-full object-cover opacity-10"
        />
        <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px]" />
      </div>



      {/* Login gate — hidden in embed mode or when already logged in */}
      {gateVisible && !loading && !isEmbed && (
        <AgentLoginGate
          agentSlug={agent.agentSlug}
          agentName={agent.companyName}
          onLoginSuccess={handleLoginSuccess}
        />
      )}

      {/* Agent branding banner */}
      <div className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 mt-4 mb-2">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-5 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {agent.logoUrl ? (
              <img
                src={agent.logoUrl}
                alt={`${agent.companyName} logo`}
                className="w-10 h-10 rounded-full object-cover border border-gray-100"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm flex-shrink-0">
                {agent.companyName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-semibold text-gray-900 text-sm leading-tight">{agent.companyName}</p>
              <p className="text-xs text-gray-500">AI Travel Planner</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!loading && isSubAgent && parentAgentSlug === agent.agentSlug && subAgentName && (
              <span className="text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full font-medium border border-green-100">
                {subAgentName}
              </span>
            )}
            <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full font-medium">
              Verified Agent
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 pb-16 flex flex-col justify-center">
        <TailoredItineraryWizard
          agentSlug={agent.agentSlug}
          subAgentId={subAgentId}
          sessionId={sessionId}
          isEmbed={isEmbed}
        />
      </div>

    </main>
  )
}
