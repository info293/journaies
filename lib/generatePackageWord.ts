import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, ImageRun,
} from 'docx'
import { getCurrencySymbol } from '@/lib/utils/currency'

export interface PackageWordOptions {
  title: string
  destination: string
  destinationCountry?: string
  durationDays?: number
  durationNights?: number
  starCategory?: string
  currency?: string
  pricePerPerson?: number | null
  totalPrice?: number | null
  gst?: number | null
  adults?: number
  kids?: number
  infants?: number
  overview?: string
  inclusions?: string[]
  exclusions?: string[]
  dayWiseItinerary?: string
  hotels?: Array<{ destination: string; nights: number; hotels: string; mealPlan: string; roomType?: string }>
  vehicles?: Array<{ vehicleType: string; seats?: number; route?: string; days?: number; notes?: string }>
  paymentPolicy?: string
  cancellationPolicy?: string
  brandName: string
  agentLogoUrl?: string
  customerName?: string
  preferredDates?: string
}

async function fetchImageAsArrayBuffer(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.arrayBuffer()
  } catch {
    return null
  }
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 24, color: '4F46E5' })],
    spacing: { before: 320, after: 120 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' },
    },
  })
}

function label(key: string, value: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `${key}: `, bold: true, size: 20 }),
      new TextRun({ text: value, size: 20 }),
    ],
    spacing: { after: 60 },
  })
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 20 })],
    bullet: { level: 0 },
    spacing: { after: 40 },
  })
}

export async function downloadPackageWord(opts: PackageWordOptions): Promise<void> {
  const {
    title, destination, destinationCountry,
    durationDays, durationNights, starCategory,
    currency, pricePerPerson, totalPrice, gst,
    adults = 1, kids = 0, infants = 0,
    overview, inclusions = [], exclusions = [],
    dayWiseItinerary, hotels = [], vehicles = [],
    paymentPolicy, cancellationPolicy,
    brandName, agentLogoUrl, customerName, preferredDates,
  } = opts

  const sections: Paragraph[] = []

  // ── Logo (if available) ────────────────────────────────
  if (agentLogoUrl) {
    const logoBuffer = await fetchImageAsArrayBuffer(agentLogoUrl)
    if (logoBuffer) {
      sections.push(new Paragraph({
        children: [new ImageRun({ data: logoBuffer, transformation: { width: 80, height: 80 }, type: 'png' })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
      }))
    }
  }

  // ── Title ──────────────────────────────────────────────
  sections.push(
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 36, color: '1F2937' })],
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: brandName, size: 22, color: '6B7280' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 320 },
    }),
  )

  // ── Basic Info ─────────────────────────────────────────
  sections.push(sectionHeading('BASIC INFORMATION'))
  sections.push(label('Destination', `${destination}${destinationCountry ? ', ' + destinationCountry : ''}`))
  if (durationDays) sections.push(label('Duration', `${durationDays} Days / ${durationNights} Nights`))
  if (starCategory) sections.push(label('Hotel Category', starCategory))
  if (preferredDates) sections.push(label('Travel Date', preferredDates))
  if (customerName) sections.push(label('Prepared For', customerName))

  const totalPax = adults + kids + infants
  const paxParts = [`${adults} Adult${adults !== 1 ? 's' : ''}`]
  if (kids > 0) paxParts.push(`${kids} Child${kids !== 1 ? 'ren' : ''}`)
  if (infants > 0) paxParts.push(`${infants} Infant${infants !== 1 ? 's' : ''}`)
  sections.push(label('Passengers', `${totalPax} Pax (${paxParts.join(', ')})`))

  if (totalPrice || pricePerPerson) {
    const sym = getCurrencySymbol(currency)
    const price = totalPrice || pricePerPerson || 0
    const priceLabel = totalPrice ? 'Total Price' : 'Price Per Person'
    const gstNote = gst ? ` + ${gst}% GST` : ''
    sections.push(label('Price', `${sym}${price.toLocaleString()} (${priceLabel})${gstNote}`))
  }

  // ── Overview ───────────────────────────────────────────
  if (overview) {
    sections.push(sectionHeading('OVERVIEW'))
    sections.push(new Paragraph({ children: [new TextRun({ text: overview, size: 20 })], spacing: { after: 80 } }))
  }

  // ── Itinerary ──────────────────────────────────────────
  if (dayWiseItinerary) {
    sections.push(sectionHeading('DAY-WISE ITINERARY'))
    String(dayWiseItinerary).split('\n').filter(Boolean).forEach(line => {
      if (/^day\s*\d+/i.test(line)) {
        sections.push(new Paragraph({
          children: [new TextRun({ text: line.trim(), bold: true, size: 22 })],
          spacing: { before: 200, after: 60 },
        }))
      } else {
        sections.push(new Paragraph({
          children: [new TextRun({ text: line.trim(), size: 20 })],
          bullet: { level: 0 },
          spacing: { after: 40 },
        }))
      }
    })
  }

  // ── Hotels ─────────────────────────────────────────────
  if (hotels.length > 0) {
    sections.push(sectionHeading('HOTEL INFORMATION'))
    hotels.forEach(h => {
      sections.push(new Paragraph({
        children: [new TextRun({ text: `${h.destination || 'Hotel'}${h.nights ? ` — ${h.nights} Night${h.nights > 1 ? 's' : ''}` : ''}`, bold: true, size: 21 })],
        spacing: { before: 160, after: 40 },
      }))
      if (h.hotels) sections.push(label('Hotel', h.hotels))
      if (h.mealPlan) sections.push(label('Meal Plan', h.mealPlan))
      if (h.roomType) sections.push(label('Room', h.roomType))
    })
  }

  // ── Transport ──────────────────────────────────────────
  if (vehicles.length > 0) {
    sections.push(sectionHeading('TRANSPORT & TRANSFERS'))
    vehicles.forEach(v => {
      if (v.vehicleType) sections.push(bullet(v.vehicleType))
    })
  }

  // ── Inclusions ─────────────────────────────────────────
  if (inclusions.length > 0) {
    sections.push(sectionHeading('INCLUSIONS'))
    inclusions.forEach(inc => sections.push(bullet(`✓  ${inc}`)))
  }

  // ── Exclusions ─────────────────────────────────────────
  if (exclusions.length > 0) {
    sections.push(sectionHeading('EXCLUSIONS'))
    exclusions.forEach(exc => sections.push(bullet(`✗  ${exc}`)))
  }

  // ── Payment Policy ─────────────────────────────────────
  if (paymentPolicy) {
    sections.push(sectionHeading('PAYMENT POLICY'))
    paymentPolicy.split('\n').filter(Boolean).forEach(line =>
      sections.push(new Paragraph({ children: [new TextRun({ text: line.trim(), size: 20 })], spacing: { after: 60 } }))
    )
  }

  // ── Cancellation Policy ────────────────────────────────
  if (cancellationPolicy) {
    sections.push(sectionHeading('CANCELLATION POLICY'))
    cancellationPolicy.split('\n').filter(Boolean).forEach(line =>
      sections.push(new Paragraph({ children: [new TextRun({ text: line.trim(), size: 20 })], spacing: { after: 60 } }))
    )
  }

  const doc = new Document({
    sections: [{ properties: {}, children: sections }],
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 20 },
        },
      },
    },
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title.replace(/[^a-z0-9]/gi, '_').slice(0, 60)}.docx`
  a.click()
  URL.revokeObjectURL(url)
}
