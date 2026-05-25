// Shared nodemailer utility — import this in API routes, never call from the browser.
// Requires: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env.local

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.travelzada.com'
const FROM    = process.env.SMTP_FROM || 'noreply@travelzada.com'

export interface MailPayload {
  to: string
  subject: string
  html: string
  fromName?: string
}

export async function sendMail(payload: MailPayload): Promise<void> {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    console.log('[Mailer] SMTP not configured — skipping:', payload.subject, '→', payload.to)
    return
  }

  const nodemailer = await import('nodemailer')
  const transporter = nodemailer.default.createTransport({
    host, port, secure: port === 465,
    auth: { user, pass },
  })

  const fromLabel = payload.fromName || process.env.SMTP_FROM_NAME || ''
  const fromField = fromLabel ? `${fromLabel} <${FROM}>` : FROM
  await transporter.sendMail({ from: fromField, to: payload.to, subject: payload.subject, html: payload.html })
}

// ─── Design Helpers ───────────────────────────────────────────────────────────

function emailWrap(opts: {
  icon: string
  preheader?: string
  title: string
  subtitle?: string
  gradient?: string
  body: string
  brand?: string
}) {
  const grad = opts.gradient ?? 'linear-gradient(135deg,#7c3aed 0%,#a855f7 100%)'
  const year = new Date().getFullYear()
  const supportEmail = process.env.SUPPORT_EMAIL || FROM
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${opts.title}</title>
</head>
<body style="margin:0;padding:0;background:#f0ebff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif">
  ${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#f0ebff">${opts.preheader}</div>` : ''}
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0ebff;padding:40px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%">

        ${opts.brand ? `<!-- Brand strip -->
        <tr><td style="padding:0 0 16px;text-align:center">
          <span style="font-size:13px;font-weight:800;color:#7c3aed;letter-spacing:1px;text-transform:uppercase">✈ ${opts.brand}</span>
        </td></tr>` : ''}

        <!-- Header -->
        <tr><td style="background:${grad};border-radius:20px 20px 0 0;padding:48px 40px 40px;text-align:center">
          <div style="display:inline-block;width:68px;height:68px;background:rgba(255,255,255,.18);border-radius:20px;font-size:32px;line-height:68px;margin-bottom:20px">${opts.icon}</div><br>
          ${opts.brand ? `<span style="color:rgba(255,255,255,.7);font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase">${opts.brand}</span><br>` : ''}
          <span style="color:#ffffff;font-size:26px;font-weight:800;line-height:1.25;display:inline-block;margin-top:8px">${opts.title}</span>
          ${opts.subtitle ? `<br><span style="color:rgba(255,255,255,.82);font-size:14px;display:inline-block;margin-top:8px">${opts.subtitle}</span>` : ''}
        </td></tr>

        <!-- White wave separator -->
        <tr><td style="background:${grad};padding:0">
          <div style="height:20px;background:#ffffff;border-radius:20px 20px 0 0;margin:0 -1px"></div>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#ffffff;padding:36px 40px 40px;border-radius:0 0 20px 20px;box-shadow:0 8px 32px rgba(124,58,237,.1)">
          ${opts.body}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:28px 24px 16px;text-align:center">
          ${opts.brand ? `<p style="margin:0 0 4px;color:#7c3aed;font-size:13px;font-weight:700;letter-spacing:.5px">${opts.brand.toUpperCase()}</p>` : ''}
          <p style="margin:0 0 8px;color:#9ca3af;font-size:12px;line-height:1.7">
            © ${year} ${opts.brand || 'Travel Platform'}
          </p>
          <p style="margin:0;color:#d1d5db;font-size:11px">
            Questions? <a href="mailto:${supportEmail}" style="color:#a78bfa;text-decoration:none">${supportEmail}</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function ctaBtn(label: string, url: string, color = '#7c3aed') {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px">
    <tr><td align="center">
      <a href="${url}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:15px 40px;border-radius:14px;letter-spacing:.3px;box-shadow:0 4px 14px rgba(124,58,237,.3)">
        ${label}
      </a>
    </td></tr>
  </table>`
}

function infoCard(rows: [string, string][], accentColor = '#7c3aed') {
  const html = rows.map(([k, v], i) => `
    <tr>
      <td style="padding:11px 18px;color:#6b7280;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;width:38%;vertical-align:top;${i > 0 ? 'border-top:1px solid #f3f4f6' : ''}">${k}</td>
      <td style="padding:11px 18px;color:#111827;font-size:14px;font-weight:500;vertical-align:top;${i > 0 ? 'border-top:1px solid #f3f4f6' : ''}">${v}</td>
    </tr>`).join('')
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#faf5ff;border:1px solid #ede9fe;border-left:4px solid ${accentColor};border-radius:0 14px 14px 0;overflow:hidden;margin:20px 0">
    ${html}
  </table>`
}

function featureRow(icon: string, text: string) {
  return `<tr>
    <td style="padding:9px 0;vertical-align:top">
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="font-size:20px;padding-right:14px;vertical-align:middle;line-height:1">${icon}</td>
          <td style="color:#374151;font-size:14px;line-height:1.6;vertical-align:middle">${text}</td>
        </tr>
      </table>
    </td>
  </tr>`
}

function featureBox(items: { icon: string; text: string }[], bg = '#faf5ff', border = '#ede9fe') {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bg};border:1px solid ${border};border-radius:14px;padding:20px 24px;margin:20px 0">
    <tr><td>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        ${items.map(i => featureRow(i.icon, i.text)).join('')}
      </table>
    </td></tr>
  </table>`
}

function stepsBox(steps: string[]) {
  const rows = steps.map((step, i) => `
    <tr>
      <td style="padding:10px 0;vertical-align:top">
        <table cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding-right:14px;vertical-align:top;padding-top:2px">
              <div style="width:28px;height:28px;background:linear-gradient(135deg,#7c3aed,#a855f7);border-radius:50%;color:#fff;font-size:12px;font-weight:800;text-align:center;line-height:28px">${i + 1}</div>
            </td>
            <td style="color:#374151;font-size:14px;line-height:1.6;vertical-align:middle">${step}</td>
          </tr>
        </table>
      </td>
    </tr>`).join('')
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#faf5ff;border:1px solid #ede9fe;border-radius:14px;padding:20px 24px;margin:20px 0">
    <tr><td>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
    </td></tr>
  </table>`
}

function badge(text: string, color: string, bg: string) {
  return `<span style="display:inline-block;background:${bg};color:${color};font-size:11px;font-weight:700;padding:5px 14px;border-radius:99px;letter-spacing:.6px;text-transform:uppercase">${text}</span>`
}

function quoteBlock(text: string, accentColor = '#7c3aed', bgColor = '#faf5ff') {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bgColor};border-left:4px solid ${accentColor};border-radius:0 12px 12px 0;padding:16px 20px;margin:20px 0">
    <tr><td>
      <p style="margin:0 0 6px;color:${accentColor};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px">Message</p>
      <p style="margin:0;color:#1f2937;font-size:14px;line-height:1.75">${text}</p>
    </td></tr>
  </table>`
}

function divider() {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0">
    <tr><td style="border-top:1px solid #f3f4f6"></td></tr>
  </table>`
}

function greeting(name: string) {
  return `<p style="margin:0 0 16px;color:#6b7280;font-size:14px">Hi <strong style="color:#111827;font-size:15px">${name}</strong>,</p>`
}

function body(text: string) {
  return `<p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.75">${text}</p>`
}

function smallNote(text: string) {
  return `<p style="margin:16px 0 0;color:#9ca3af;font-size:12px;text-align:center;line-height:1.6">${text}</p>`
}

// ─── Email Builders ───────────────────────────────────────────────────────────

export function buildCustomerWelcomeEmail(opts: { name: string }): MailPayload {
  return {
    to: '',
    subject: `Welcome, ${opts.name} — Your journey starts here ✈️`,
    html: emailWrap({
      icon: '✈️',
      preheader: `Hi ${opts.name}, your account is ready. Let's plan something amazing!`,
      title: `Welcome, ${opts.name}!`,
      subtitle: 'Your adventure begins here',
      body: `
        ${greeting(opts.name)}
        ${body("We're thrilled to have you on board. Enjoy AI-powered travel planning, handpicked packages, and seamless booking — all in one beautiful place.")}

        ${featureBox([
          { icon: '🤖', text: '<strong>AI Trip Planner</strong> — Get a personalised itinerary tailored to your preferences in minutes' },
          { icon: '🏖️', text: '<strong>Curated Packages</strong> — Explore handpicked deals from top-rated travel agents' },
          { icon: '💬', text: '<strong>Expert Support</strong> — Chat with travel professionals at every step' },
          { icon: '📱', text: '<strong>Share & Save</strong> — Save your favourites and share itineraries with friends' },
        ])}

        ${ctaBtn('Start Exploring →', APP_URL)}
        ${divider()}
        ${smallNote("If you didn't create this account, you can safely ignore this email.")}
      `,
    }),
  }
}

export function buildDmcSignupEmail(opts: { contactName: string; companyName: string }): MailPayload {
  return {
    to: '',
    subject: `Application Received — ${opts.companyName}`,
    html: emailWrap({
      icon: '🏢',
      preheader: `Thanks for applying, ${opts.contactName}. Our team is reviewing your application.`,
      title: 'Application Received!',
      subtitle: 'Our team is reviewing your request',
      brand: opts.companyName,
      body: `
        ${greeting(opts.contactName)}
        ${body(`Thank you for registering <strong>${opts.companyName}</strong> as a DMC Partner. We've received your application and will get back to you within <strong>1–2 business days</strong>.`)}

        <p style="margin:0 0 6px;text-align:center">${badge('Pending Review', '#92400e', '#fef3c7')}</p>

        <p style="margin:20px 0 4px;color:#111827;font-size:14px;font-weight:700">What happens next?</p>
        ${stepsBox([
          'Our team carefully reviews your application',
          'You receive an approval email with full dashboard access',
          'Add your packages and invite your travel agents',
          'Start receiving bookings and grow your business',
        ])}

        ${divider()}
        ${smallNote(`Questions? <a href="mailto:${process.env.SMTP_FROM || ''}" style="color:#7c3aed;text-decoration:none">Contact Support</a>`)}
      `,
    }),
  }
}

export function buildTravelAgentSignupEmail(opts: { name: string; agentCompanyName: string }): MailPayload {
  return {
    to: '',
    subject: `Registration Received — ${opts.agentCompanyName} Travel Team`,
    fromName: opts.agentCompanyName,
    html: emailWrap({
      icon: '👋',
      preheader: `Hi ${opts.name}, your request to join ${opts.agentCompanyName} has been received.`,
      title: 'Registration Received!',
      subtitle: `Pending approval from ${opts.agentCompanyName}`,
      brand: opts.agentCompanyName,
      body: `
        ${greeting(opts.name)}
        ${body(`Your request to join <strong>${opts.agentCompanyName}</strong>'s travel team has been submitted. The agency manager will review and approve your account shortly.`)}

        <p style="margin:0 0 20px;text-align:center">${badge('Pending Approval', '#92400e', '#fef3c7')}</p>

        <p style="margin:0 0 4px;color:#111827;font-size:14px;font-weight:700">Once approved, you'll be able to:</p>
        ${featureBox([
          { icon: '🤖', text: 'Access the AI Travel Planner with your login credentials' },
          { icon: '📋', text: 'Create and send branded quotations to customers' },
          { icon: '📊', text: 'Track your bookings and commissions in real time' },
          { icon: '💬', text: `Collaborate directly with <strong>${opts.agentCompanyName}</strong> on every deal` },
        ])}

        ${divider()}
        ${smallNote(`Registered via an invitation link from <strong>${opts.agentCompanyName}</strong>.`)}
      `,
    }),
  }
}

export function buildTravelAgentSignupNotifyDmcEmail(opts: {
  agentCompanyName: string
  dmcContactName?: string
  travelAgentName: string
  travelAgentEmail: string
  dashboardUrl: string
}): MailPayload {
  return {
    to: '',
    subject: `New Agent Request — ${opts.travelAgentName} wants to join ${opts.agentCompanyName}`,
    fromName: opts.agentCompanyName,
    html: emailWrap({
      icon: '🔔',
      preheader: `${opts.travelAgentName} has requested to join ${opts.agentCompanyName}.`,
      title: 'New Team Member Request',
      subtitle: 'Action required — approve or reject in your dashboard',
      gradient: 'linear-gradient(135deg,#ea580c 0%,#f97316 100%)',
      brand: opts.agentCompanyName,
      body: `
        ${opts.dmcContactName ? greeting(opts.dmcContactName) : ''}
        ${body(`<strong>${opts.travelAgentName}</strong> has requested to join <strong>${opts.agentCompanyName}</strong>. Review their request and take action from your dashboard.`)}

        ${infoCard([
          ['Name', `<strong>${opts.travelAgentName}</strong>`],
          ['Email', opts.travelAgentEmail],
          ['Team', opts.agentCompanyName],
          ['Status', badge('Pending Review', '#92400e', '#fef3c7')],
        ], '#ea580c')}

        ${ctaBtn('Review in Dashboard →', opts.dashboardUrl, '#ea580c')}
        ${divider()}
        ${smallNote('Go to the <strong>Travel Agents</strong> tab in your DMC Dashboard to approve or reject.')}
      `,
    }),
  }
}

export function buildTravelAgentApprovedEmail(opts: {
  name: string
  agentCompanyName: string
  plannerUrl: string
}): MailPayload {
  return {
    to: '',
    subject: `You're Approved! — Start Planning with ${opts.agentCompanyName}`,
    fromName: opts.agentCompanyName,
    html: emailWrap({
      icon: '🎉',
      preheader: `Congratulations ${opts.name}! Your travel agent account with ${opts.agentCompanyName} has been approved.`,
      title: "You're Approved!",
      subtitle: `Welcome to ${opts.agentCompanyName}'s team`,
      gradient: 'linear-gradient(135deg,#059669 0%,#10b981 100%)',
      brand: opts.agentCompanyName,
      body: `
        ${greeting(opts.name)}
        ${body(`Great news! <strong>${opts.agentCompanyName}</strong> has approved your travel agent account. You're all set — start creating itineraries and delighting your customers today.`)}

        ${featureBox([
          { icon: '🤖', text: '<strong>AI Travel Planner</strong> — Build stunning itineraries in minutes' },
          { icon: '📋', text: '<strong>Quotations</strong> — Send professional, branded quotes instantly' },
          { icon: '💰', text: '<strong>Commissions</strong> — Track your earnings in real time' },
          { icon: '📊', text: '<strong>Dashboard</strong> — Manage all bookings from one place' },
        ], '#f0fdf4', '#bbf7d0')}

        ${ctaBtn('Open Travel Planner →', opts.plannerUrl, '#059669')}
        ${divider()}
        ${smallNote('Use your registered email and password to log in.')}
      `,
    }),
  }
}

export function buildNewQuotationNotifyDmcEmail(opts: {
  dmcName: string
  companyName: string
  subAgentName: string
  customerName: string
  packageTitle: string
  paxLabel: string
  rooms: number
  preferredDates?: string
  dashboardUrl: string
}): MailPayload {
  const rows: [string, string][] = [
    ['Customer', `<strong>${opts.customerName}</strong>`],
    ['Package', `<strong>${opts.packageTitle}</strong>`],
    ['Passengers', `${opts.paxLabel} &nbsp;·&nbsp; ${opts.rooms} room${opts.rooms !== 1 ? 's' : ''}`],
    ...(opts.preferredDates ? [['Travel Dates', opts.preferredDates] as [string, string]] : []),
    ['Created By', opts.subAgentName],
  ]
  return {
    to: '',
    subject: `New Quotation Request — ${opts.packageTitle} | ${opts.subAgentName}`,
    fromName: opts.companyName,
    html: emailWrap({
      icon: '📋',
      preheader: `${opts.subAgentName} created a new quotation for ${opts.customerName}.`,
      title: 'New Quotation Request',
      subtitle: `From ${opts.subAgentName}`,
      brand: opts.companyName,
      body: `
        ${greeting(opts.dmcName)}
        ${body(`<strong>${opts.subAgentName}</strong> has created a new quotation request. Review it in your dashboard and respond to keep the deal moving.`)}

        ${infoCard(rows)}

        ${ctaBtn('Open Dashboard →', opts.dashboardUrl)}
        ${divider()}
        ${smallNote('Go to the <strong>Quotations</strong> tab in your DMC Dashboard to review and respond.')}
      `,
    }),
  }
}

// ─── Messaging Emails (agent ↔ DMC) ──────────────────────────────────────────

export function buildMessageToAgentEmail(opts: {
  agentName: string
  senderName: string
  quotationTitle: string
  customerName: string
  messagePreview: string
  dashboardUrl: string
}): MailPayload {
  return {
    to: '',
    subject: `💬 New message from ${opts.senderName} — ${opts.quotationTitle}`,
    fromName: opts.senderName,
    html: emailWrap({
      icon: '💬',
      preheader: `${opts.senderName} sent you a message about ${opts.customerName}'s quotation.`,
      title: 'New Message',
      subtitle: `From ${opts.senderName}`,
      brand: opts.senderName,
      body: `
        ${greeting(opts.agentName)}
        ${body(`<strong>${opts.senderName}</strong> sent you a message about the quotation for <strong>${opts.customerName}</strong>.`)}

        ${quoteBlock(opts.messagePreview)}

        ${infoCard([
          ['Quotation', opts.quotationTitle],
          ['Customer', opts.customerName],
          ['From', opts.senderName],
        ])}

        ${ctaBtn('Reply in Dashboard →', opts.dashboardUrl)}
        ${divider()}
        ${smallNote('Reply from your Travel Agent Dashboard. Do not reply to this email directly.')}
      `,
    }),
  }
}

export function buildMessageToDmcEmail(opts: {
  dmcContactName: string
  senderName: string
  quotationTitle: string
  customerName: string
  messagePreview: string
  dashboardUrl: string
}): MailPayload {
  return {
    to: '',
    subject: `💬 ${opts.senderName} replied on ${opts.quotationTitle}`,
    fromName: opts.senderName,
    html: emailWrap({
      icon: '💬',
      preheader: `${opts.senderName} sent a message on the quotation for ${opts.customerName}.`,
      title: 'Travel Agent Replied',
      subtitle: `New message from ${opts.senderName}`,
      gradient: 'linear-gradient(135deg,#0891b2 0%,#06b6d4 100%)',
      brand: opts.senderName,
      body: `
        ${greeting(opts.dmcContactName)}
        ${body(`<strong>${opts.senderName}</strong> sent a message on the quotation for <strong>${opts.customerName}</strong>.`)}

        ${quoteBlock(opts.messagePreview, '#0891b2', '#ecfeff')}

        ${infoCard([
          ['Quotation', opts.quotationTitle],
          ['Customer', opts.customerName],
          ['From Agent', opts.senderName],
        ], '#0891b2')}

        ${ctaBtn('Open in DMC Dashboard →', opts.dashboardUrl, '#0891b2')}
        ${divider()}
        ${smallNote('Reply from your DMC Dashboard → Quotations tab. Do not reply to this email directly.')}
      `,
    }),
  }
}
