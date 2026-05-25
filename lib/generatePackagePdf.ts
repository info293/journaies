import { getCurrencySymbol } from '@/lib/utils/currency'

export interface PackagePdfOptions {
  title: string
  destination: string
  destinationCountry?: string
  heroImage?: string
  badgeText?: string
  refId?: string
  durationDays?: number
  durationNights?: number
  starCategory?: string
  travelType?: string
  theme?: string
  mood?: string
  currency?: string
  pricePerPerson?: number | null
  totalPrice?: number | null
  gst?: number | null
  quotedPriceTotal?: number | null
  groupSize?: number
  adults?: number
  kids?: number
  infants?: number
  overview?: string
  highlights?: string[]
  inclusions?: string[]
  exclusions?: string[]
  dayWiseItinerary?: string
  hotels?: Array<{ destination: string; nights: number; hotels: string; mealPlan: string; roomType?: string }>
  vehicles?: Array<{ vehicleType: string; seats?: number; route: string; days?: number; notes?: string }>
  specialRequests?: string
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  preferredDates?: string
  brandName: string
  agentContactName?: string
  agentLogoUrl?: string
  paymentPolicy?: string
  cancellationPolicy?: string
  termsVariant?: 'brochure' | 'quotation'
}

async function urlToBase64(url: string, label = 'image'): Promise<string> {
  console.log(`[PDF] Fetching ${label}: ${url}`)
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.error(`[PDF] ${label} fetch failed — HTTP ${res.status} ${res.statusText} — URL: ${url}`)
      return ''
    }
    const blob = await res.blob()
    console.log(`[PDF] ${label} fetched OK — size: ${blob.size} bytes, type: ${blob.type}`)
    return await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        console.log(`[PDF] ${label} converted to base64 — length: ${result.length}`)
        resolve(result)
      }
      reader.onerror = (e) => {
        console.error(`[PDF] ${label} FileReader error:`, e)
        resolve('')
      }
      reader.readAsDataURL(blob)
    })
  } catch (err) {
    console.error(`[PDF] ${label} fetch threw an error:`, err)
    return ''
  }
}

export async function openPackagePdfWindow(opts: PackagePdfOptions): Promise<void> {
  const {
    title, destination, destinationCountry, heroImage = '',
    badgeText, refId,
    durationDays, durationNights, starCategory, travelType, theme, mood,
    currency, pricePerPerson, totalPrice, gst, quotedPriceTotal, groupSize = 1, adults, kids, infants,
    overview, highlights = [], inclusions = [], exclusions = [],
    dayWiseItinerary, hotels = [], vehicles = [], specialRequests,
    customerName, customerEmail, customerPhone, preferredDates,
    brandName, agentContactName, agentLogoUrl, paymentPolicy, cancellationPolicy, termsVariant = 'brochure',
  } = opts

  const currSym = getCurrencySymbol(currency)
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  console.log('[PDF] openPackagePdfWindow called with:', {
    agentLogoUrl: agentLogoUrl || 'NOT PROVIDED',
    heroImage: heroImage || 'NOT PROVIDED',
    brandName,
    agentContactName,
  })

  // Pre-load images as base64 so they always render in the print popup
  const [logoBase64, heroBase64] = await Promise.all([
    agentLogoUrl ? urlToBase64(agentLogoUrl, 'agent-logo') : Promise.resolve(''),
    heroImage ? urlToBase64(heroImage, 'hero-image') : Promise.resolve(''),
  ])

  console.log('[PDF] Base64 results —', {
    logoBase64: logoBase64 ? `OK (${logoBase64.length} chars)` : 'EMPTY',
    heroBase64: heroBase64 ? `OK (${heroBase64.length} chars)` : 'EMPTY',
  })

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' IST'

  const autoRefId = refId || `TZ-${now.getFullYear()}-${String(Math.floor(10000 + Math.random() * 90000))}`
  const durationLabel = durationNights ? `${durationNights}N / ${durationDays}D` : durationDays ? `${durationDays}D` : '—'
  const badgeLabel = badgeText || `HOLIDAY PACKAGE · ${(destinationCountry || destination).toUpperCase()}`
  const agentName = agentContactName || ''

  function renderStars(cat: string): string {
    const n = parseInt(cat.match(/\d/)?.[0] || '0')
    return n > 0 ? '★'.repeat(n) : esc(cat)
  }

  // Parse days from itinerary text
  const days: { title: string; desc: string }[] = []
  if (dayWiseItinerary) {
    let cur: { title: string; desc: string } | null = null
    for (const line of dayWiseItinerary.split('\n').filter(Boolean)) {
      if (/^day\s*\d+/i.test(line)) {
        if (cur) days.push(cur)
        cur = { title: line.trim(), desc: '' }
      } else if (cur) {
        cur.desc += (cur.desc ? '\n' : '') + line.trim()
      }
    }
    if (cur) days.push(cur)
  }

  function cleanDayTitle(raw: string): string {
    return raw.replace(/^day\s*\d+[\s:·–\-]*/i, '').trim() || raw
  }

  let sectionNum = 0
  function nextNum() { return String(++sectionNum).padStart(2, '0') }

  const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8">
<title>${esc(title)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1f2937;background:#fff;font-size:14px}
@page{margin:0;size:A4}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}

/* ── Page header ── */
.ph{display:flex;justify-content:space-between;align-items:center;padding:18px 44px;border-bottom:1px solid #e5e7eb;min-height:72px}
.agent-logo{max-height:48px;max-width:180px;object-fit:contain;display:block}
.agent-name-fallback{font-size:16px;font-weight:800;color:#111;letter-spacing:-.2px}
.quot-wrap{text-align:right}
.quot-lbl{font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.15em}
.quot-num{font-size:15px;font-weight:700;color:#111;margin-top:4px}

/* ── Hero ── */
.hero{position:relative;height:320px;overflow:hidden}
.hero img{width:100%;height:100%;object-fit:cover;display:block}
.hero-bg{width:100%;height:100%;background:linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%)}
.overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.82) 0%,rgba(0,0,0,.28) 55%,transparent 100%)}
.hero-top{position:absolute;top:28px;left:44px}
.hero-badge{background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.28);color:#fff;font-size:10px;font-weight:700;letter-spacing:.1em;padding:6px 16px;border-radius:999px;display:inline-block}
.hero-bot{position:absolute;bottom:32px;left:44px;right:44px}
.hero-title{font-size:36px;font-weight:800;color:#fff;line-height:1.15;margin-bottom:12px}
.hero-dest{font-size:13px;color:rgba(255,255,255,.78);font-weight:500}

/* ── Stats strip ── */
.stats{display:grid;grid-template-columns:repeat(5,1fr);background:#fff;border-bottom:2px solid #e5e7eb}
.sc{padding:18px 22px;border-right:1px solid #e5e7eb}
.sc:last-child{border-right:none}
.slbl{font-size:8.5px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.12em;margin-bottom:7px}
.sval{font-size:19px;font-weight:800;color:#111;line-height:1.2}
.ssub{font-size:11px;color:#6b7280;margin-top:5px}
.stars{color:#f59e0b;font-size:16px;letter-spacing:2px}

/* ── Body ── */
.body{padding:44px 48px 40px}

/* ── Section ── */
.section{margin-bottom:48px}
.sec-hdr{display:flex;align-items:center;gap:14px;padding-bottom:14px;border-bottom:2px solid #e5e7eb;margin-bottom:26px;break-after:avoid;page-break-after:avoid}
.sec-num{font-size:13px;font-weight:700;color:#7c3aed;letter-spacing:.04em}
.sec-title{font-size:22px;font-weight:800;color:#111;letter-spacing:-.3px}

/* ── Overview ── */
.overview{font-size:14px;color:#374151;line-height:1.85}

/* ── Day items ── */
.day-item{display:flex;gap:24px;padding:22px 0;border-bottom:1px solid #f3f4f6;break-inside:avoid;page-break-inside:avoid}
.day-item:last-child{border-bottom:none}
.day-left{flex-shrink:0;width:58px;padding-top:2px}
.day-lbl{font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.1em}
.day-num{font-size:30px;font-weight:800;color:#111;line-height:1}
.day-content{flex:1;min-width:0}
.day-title{font-size:15px;font-weight:700;color:#111;margin-bottom:8px;line-height:1.4}
.day-desc{font-size:13px;color:#6b7280;line-height:1.75;margin-bottom:12px}

/* ── Hotels table ── */
.htable{width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden}
.htable th{font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;padding:12px 18px;text-align:left;background:#f9fafb;border-bottom:1px solid #e5e7eb}
.htable td{font-size:13px;color:#374151;padding:14px 18px;border-bottom:1px solid #f3f4f6;vertical-align:top;line-height:1.55}
.htable tr{break-inside:avoid;page-break-inside:avoid}
.htable tr:last-child td{border-bottom:none}
.hotel-dest{font-weight:700;color:#111}
.meal-pill{display:inline-block;font-size:11px;font-weight:500;color:#059669;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:999px;padding:3px 10px}

/* ── Vehicles table ── */
.vtable{width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden}
.vtable th{font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;padding:12px 18px;text-align:left;background:#f9fafb;border-bottom:1px solid #e5e7eb}
.vtable td{font-size:13px;color:#374151;padding:14px 18px;border-bottom:1px solid #f3f4f6;vertical-align:top;line-height:1.55}
.vtable tr{break-inside:avoid;page-break-inside:avoid}
.vtable tr:last-child td{border-bottom:none}
.vtype{font-weight:700;color:#111}
.vnotes{font-size:12px;color:#9ca3af;margin-top:4px}

/* ── Inc / Exc ── */
.ie-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.ie-box{border:1px solid #e5e7eb;border-radius:14px;padding:22px;break-inside:avoid;page-break-inside:avoid}
.ie-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}
.ie-htitle{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700}
.ie-count{font-size:11px;color:#9ca3af}
.ie-row{display:flex;align-items:flex-start;gap:10px;margin-bottom:11px}
.ie-row:last-child{margin-bottom:0}
.ie-icon{flex-shrink:0;margin-top:2px}
.ie-text{font-size:13px;color:#374151;line-height:1.55}

/* ── Policies ── */
.policy-box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:22px 26px}
.policy-line{font-size:13px;color:#374151;line-height:1.75;padding:4px 0;border-bottom:1px solid #f3f4f6}
.policy-line:last-child{border-bottom:none}

/* ── Footer ── */
.footer{margin-top:40px;padding-top:24px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:flex-end}
.ft-lbl{font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.13em;margin-bottom:8px}
.ft-name{font-size:16px;font-weight:800;color:#111;margin-bottom:4px}
.ft-sub{font-size:12px;color:#6b7280}
.ft-right{text-align:right}
.ft-date{font-size:11px;color:#9ca3af;margin-top:4px}

/* ── Customer card (if quotation) ── */
.cust-banner{background:#f9fafb;border:1px solid #e5e7eb;border-radius:14px;padding:22px 26px;margin-bottom:32px;display:flex;justify-content:space-between;align-items:center;break-inside:avoid;page-break-inside:avoid}
.cust-lbl{font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.13em;margin-bottom:6px}
.cust-name{font-size:20px;font-weight:800;color:#111}
.cust-meta{font-size:12px;color:#6b7280;margin-top:5px}
.price-banner{background:#7c3aed;border-radius:14px;padding:20px 24px;text-align:right}
.price-lbl{font-size:9px;font-weight:700;color:#ddd6fe;text-transform:uppercase;letter-spacing:.13em;margin-bottom:6px}
.price-val{font-size:26px;font-weight:800;color:#fff}
.price-sub{font-size:10px;color:rgba(255,255,255,.7);margin-top:3px}
</style>
</head>
<body>

<!-- ── Page Header ── -->
<div class="ph">
  <div>
    ${logoBase64
      ? `<img src="${logoBase64}" alt="${esc(brandName)}" class="agent-logo" />`
      : agentLogoUrl
        ? `<img src="${esc(agentLogoUrl)}" alt="${esc(brandName)}" class="agent-logo" />`
        : `<span class="agent-name-fallback">${esc(brandName)}</span>`
    }
  </div>
  <div class="quot-wrap">
    <div class="quot-lbl">Quotation No.</div>
    <div class="quot-num">${esc(autoRefId)}</div>
  </div>
</div>

<!-- ── Hero ── -->
<div class="hero">
  ${heroBase64
    ? `<img src="${heroBase64}" alt="" />`
    : heroImage
      ? `<img src="${esc(heroImage)}" alt="" crossorigin="anonymous" />`
      : '<div class="hero-bg"></div>'
  }
  <div class="overlay"></div>
  <div class="hero-top">
    <span class="hero-badge">${esc(badgeLabel)}</span>
  </div>
  <div class="hero-bot">
    <h1 class="hero-title">${esc(title)}</h1>
    <p class="hero-dest">${esc(destination)}${destinationCountry ? ` · ${esc(destinationCountry)}` : ''}</p>
  </div>
</div>

<!-- ── Stats Strip ── -->
<div class="stats">
  <div class="sc">
    <div class="slbl">Duration</div>
    <div class="sval">${durationLabel}</div>
  </div>
  <div class="sc">
    <div class="slbl">Hotel Category</div>
    <div class="sval">${starCategory ? `<span class="stars">${renderStars(starCategory)}</span>` : '—'}</div>
    <div class="ssub">${starCategory ? esc(starCategory) : '—'}</div>
  </div>
  <div class="sc">
    <div class="slbl">Total Passengers</div>
    <div class="sval">${groupSize < 10 ? String(groupSize).padStart(2, '0') : groupSize} pax</div>
    <div class="ssub">${adults ?? groupSize} Adult${(adults ?? groupSize) !== 1 ? 's' : ''}${kids ? ` · ${kids} Child${kids !== 1 ? 'ren' : ''}` : ''}${infants ? ` · ${infants} Infant${infants !== 1 ? 's' : ''}` : ''}</div>
  </div>
  <div class="sc">
    ${totalPrice
      ? `<div class="slbl">Total Price</div>
         <div class="sval">${currSym}${Number(totalPrice).toLocaleString()}</div>
         ${gst ? `<div class="ssub">+ ${gst}% GST</div>` : ''}`
      : `<div class="slbl">Price Per Person</div>
         <div class="sval">${pricePerPerson ? `${currSym}${Number(pricePerPerson).toLocaleString()}` : '—'}</div>
         ${gst ? `<div class="ssub">+ ${gst}% GST</div>` : ''}`
    }
  </div>
  <div class="sc">
    <div class="slbl">Date of Travel</div>
    <div class="sval" style="font-size:14px;line-height:1.4">${preferredDates ? esc(preferredDates) : '—'}</div>
  </div>
</div>

<!-- ── Body ── -->
<div class="body">

  ${customerName ? `
  <div class="cust-banner">
    <div>
      <div class="cust-lbl">Prepared For</div>
      <div class="cust-name">${esc(customerName)}</div>
      ${customerEmail || customerPhone ? `<div class="cust-meta">${[customerPhone, customerEmail].filter((v): v is string => Boolean(v)).map(esc).join(' · ')}</div>` : ''}
    </div>
  </div>` : ''}

  ${overview ? `
  <div class="section">
    <div class="sec-hdr">
      <span class="sec-num">${nextNum()}</span>
      <span class="sec-title">Overview</span>
    </div>
    <p class="overview">${esc(overview)}</p>
  </div>` : ''}

  ${days.length ? `
  <div class="section">
    <div class="sec-hdr">
      <span class="sec-num">${nextNum()}</span>
      <span class="sec-title">Daywise Itinerary</span>
    </div>
    ${days.map((d, i) => {
      const cleanTitle = cleanDayTitle(d.title)
      const visibleDesc = d.desc.trim()
      return `<div class="day-item">
        <div class="day-left">
          <div class="day-lbl">DAY</div>
          <div class="day-num">${String(i + 1).padStart(2, '0')}</div>
        </div>
        <div class="day-content">
          <div class="day-title">${esc(cleanTitle)}</div>
          ${visibleDesc ? `<div class="day-desc">${esc(visibleDesc).replace(/\n/g, '<br>')}</div>` : ''}
        </div>
      </div>`
    }).join('')}
  </div>` : ''}

  ${hotels.length ? `
  <div class="section">
    <div class="sec-hdr">
      <span class="sec-num">${nextNum()}</span>
      <span class="sec-title">Hotel Information</span>
    </div>
    <table class="htable">
      <thead>
        <tr>
          <th>Destination</th>
          <th>Nights</th>
          <th>Hotel(s)</th>
          <th>Meal Plan</th>
          <th>Room Type</th>
        </tr>
      </thead>
      <tbody>
        ${hotels.map(h => `
        <tr>
          <td><span class="hotel-dest">${esc(h.destination || '')}</span></td>
          <td>${h.nights ? `${h.nights}N` : '—'}</td>
          <td>${esc(h.hotels || '—')}</td>
          <td>${h.mealPlan ? `<span class="meal-pill">${esc(h.mealPlan)}</span>` : '—'}</td>
          <td>${esc(h.roomType || '—')}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}

  ${vehicles.length ? `
  <div class="section">
    <div class="sec-hdr">
      <span class="sec-num">${nextNum()}</span>
      <span class="sec-title">Transport &amp; Transfers</span>
    </div>
    <table class="vtable">
      <thead>
        <tr>
          <th>Vehicle</th>
          <th>Seats</th>
          <th>Route / Usage</th>
          <th>Days</th>
        </tr>
      </thead>
      <tbody>
        ${vehicles.map(v => `
        <tr>
          <td>
            <div class="vtype">${esc(v.vehicleType || '—')}</div>
            ${v.notes ? `<div class="vnotes">${esc(v.notes)}</div>` : ''}
          </td>
          <td>${v.seats ? v.seats : '—'}</td>
          <td>${esc(v.route || '—')}</td>
          <td>${v.days ? `${v.days}D` : '—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}

  ${(inclusions.length || exclusions.length) ? `
  <div class="section">
    <div class="sec-hdr">
      <span class="sec-num">${nextNum()}</span>
      <span class="sec-title">What's Included &amp; What's Not</span>
    </div>
    <div class="ie-grid">
      <div class="ie-box">
        <div class="ie-hdr">
          <div class="ie-htitle" style="color:#059669">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="7" fill="#059669"/>
              <path d="M4 7.2l2.2 2.2 3.8-3.8" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Inclusions
          </div>
          <span class="ie-count">${inclusions.length} items</span>
        </div>
        ${inclusions.map(item => `
        <div class="ie-row">
          <svg class="ie-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect width="14" height="14" rx="3" fill="#f0fdf4"/>
            <path d="M3.5 7l2.5 2.5 4.5-4.5" stroke="#059669" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="ie-text">${esc(item)}</span>
        </div>`).join('')}
      </div>
      <div class="ie-box">
        <div class="ie-hdr">
          <div class="ie-htitle" style="color:#dc2626">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="7" fill="#dc2626"/>
              <path d="M5 5l4 4M9 5l-4 4" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            Exclusions
          </div>
          <span class="ie-count">${exclusions.length} items</span>
        </div>
        ${exclusions.map(item => `
        <div class="ie-row">
          <svg class="ie-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect width="14" height="14" rx="3" fill="#fff1f2"/>
            <path d="M4.5 4.5l5 5M9.5 4.5l-5 5" stroke="#dc2626" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          <span class="ie-text">${esc(item)}</span>
        </div>`).join('')}
      </div>
    </div>
  </div>` : ''}

  ${paymentPolicy ? `
  <div class="section">
    <div class="sec-hdr">
      <span class="sec-num">${nextNum()}</span>
      <span class="sec-title">Payment Policy</span>
    </div>
    <div class="policy-box">
      ${paymentPolicy.split('\n').filter(Boolean).map(line => `<p class="policy-line">${esc(line)}</p>`).join('')}
    </div>
  </div>` : ''}

  ${cancellationPolicy ? `
  <div class="section">
    <div class="sec-hdr">
      <span class="sec-num">${nextNum()}</span>
      <span class="sec-title">Cancellation Policy</span>
    </div>
    <div class="policy-box">
      ${cancellationPolicy.split('\n').filter(Boolean).map(line => `<p class="policy-line">${esc(line)}</p>`).join('')}
    </div>
  </div>` : ''}

  <div class="footer">
    ${agentName ? `<div>
      <div class="ft-lbl">Prepared by your travel agent</div>
      <div class="ft-name">${esc(agentName)}</div>
    </div>` : '<div></div>'}
    <div class="ft-right">
      <div class="ft-date">Downloaded ${dateStr} · ${timeStr}</div>
    </div>
  </div>

</div>
</body></html>`

  const win = window.open('', '_blank', 'width=900,height=1200')
  if (!win) { alert('Please allow pop-ups to generate the PDF.'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 400)
}
