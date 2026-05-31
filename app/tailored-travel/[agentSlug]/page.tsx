export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocsFromServer } from 'firebase/firestore'
import AgentBrandedWizard from '@/components/tailored-travel/AgentBrandedWizard'

interface Props {
  params: { agentSlug: string }
}

async function getAgentData(agentSlug: string) {
  try {
    const agentsRef = collection(db, 'agents')
    const q = query(agentsRef, where('agentSlug', '==', agentSlug), where('status', '==', 'active'))
    const snap = await getDocsFromServer(q)

    if (snap.empty) return null

    const data = snap.docs[0].data()
    return {
      id: snap.docs[0].id,
      companyName: data.companyName as string,
      contactName: data.contactName as string,
      agentSlug: data.agentSlug as string,
      logoUrl: data.logoUrl as string | null,
      fallbackToTravelzada: data.fallbackToTravelzada as boolean,
    }
  } catch (e) {
    return null
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const agent = await getAgentData(params.agentSlug)
  if (!agent) {
    return { title: 'Agent Not Found' }
  }
  return {
    title: `Plan Your Trip with ${agent.companyName}`,
    description: `Design your perfect custom itinerary with ${agent.companyName}, powered by AI.`,
  }
}

export default async function AgentPlannerPage({ params }: Props) {
  const agent = await getAgentData(params.agentSlug)

  if (!agent) {
    notFound()
  }

  return (
    <AgentBrandedWizard agent={agent} />
  )
}
