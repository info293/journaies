export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import {
  sendMail,
  buildCustomerWelcomeEmail,
  buildDmcSignupEmail,
  buildTravelAgentSignupEmail,
  buildTravelAgentSignupNotifyDmcEmail,
  buildTravelAgentApprovedEmail,
} from '@/lib/mailer'
import { logApiError } from '@/lib/api-logger'

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://www.travelzada.com'

export async function POST(request: Request) {
  try {
    const { type, data } = await request.json()

    switch (type) {
      case 'customer_signup': {
        const mail = buildCustomerWelcomeEmail({ name: data.name })
        mail.to = data.email
        await sendMail(mail)
        break
      }

      case 'dmc_signup': {
        const mail = buildDmcSignupEmail({ contactName: data.contactName, companyName: data.companyName })
        mail.to = data.email
        await sendMail(mail)
        break
      }

      case 'travel_agent_signup': {
        const mail = buildTravelAgentSignupEmail({ name: data.name, agentCompanyName: data.agentCompanyName })
        mail.to = data.email
        await sendMail(mail)
        break
      }

      case 'travel_agent_signup_notify_dmc': {
        const mail = buildTravelAgentSignupNotifyDmcEmail({
          agentCompanyName: data.agentCompanyName,
          dmcContactName: data.dmcContactName,
          travelAgentName: data.travelAgentName,
          travelAgentEmail: data.travelAgentEmail,
          dashboardUrl: data.dashboardUrl || `${BASE}/dmc-dashboard`,
        })
        mail.to = data.agentEmail
        await sendMail(mail)
        break
      }

      case 'travel_agent_approved': {
        const mail = buildTravelAgentApprovedEmail({
          name: data.name,
          agentCompanyName: data.agentCompanyName,
          plannerUrl: data.plannerUrl,
        })
        mail.to = data.email
        await sendMail(mail)
        break
      }

      default:
        return NextResponse.json({ error: 'Unknown email type' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    await logApiError('/api/email/send', 'POST', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
