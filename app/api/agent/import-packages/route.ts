export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, getDocs } from 'firebase/firestore'

// Destination_ID prefixes → human-readable destination name
const DEST_MAP: Record<string, string> = {
  RAJ: 'Rajasthan',
  KAS: 'Kashmir',
  KER: 'Kerala',
}

function getDestination(destinationId: string): string | null {
  const prefix = destinationId?.split('_')[0]?.toUpperCase()
  return DEST_MAP[prefix] || null
}

function parseDuration(pkg: any): { days: number; nights: number } {
  if (pkg.Duration_Nights || pkg.Duration_Days) {
    return { nights: Number(pkg.Duration_Nights) || 0, days: Number(pkg.Duration_Days) || 0 }
  }
  const str: string = pkg.Duration || ''
  const n = str.match(/(\d+)\s*N/i)
  const d = str.match(/(\d+)\s*D/i)
  const nights = n ? parseInt(n[1]) : 0
  const days   = d ? parseInt(d[1]) : nights + 1
  return { nights, days }
}

function parsePrice(pkg: any): number {
  if (pkg.Price_Min_INR && Number(pkg.Price_Min_INR) > 0) return Number(pkg.Price_Min_INR)
  if (pkg.Price_Max_INR && Number(pkg.Price_Max_INR) > 0) return Math.round(Number(pkg.Price_Max_INR) * 0.7)
  const range = String(pkg.Price_Range_INR || '')
  const match = range.match(/[\d,]+/)
  return match ? parseInt(match[0].replace(/,/g, '')) : 0
}

function parseList(val: any): string[] {
  if (!val) return []
  if (Array.isArray(val)) return val.filter(Boolean)
  return String(val).split(/\n|,|\|/).map((s: string) => s.trim()).filter(Boolean)
}

function cleanUrl(url: string): string {
  if (!url) return ''
  return url.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$2').trim()
}

function buildItinerary(pkg: any): string {
  if (Array.isArray(pkg.Day_Wise_Itinerary_Details) && pkg.Day_Wise_Itinerary_Details.length > 0) {
    return pkg.Day_Wise_Itinerary_Details.map((d: any) => {
      const acts = Array.isArray(d.activities) ? d.activities.join(', ') : ''
      return `Day ${d.day}: ${d.title}${d.description ? '\n' + d.description : ''}${acts ? '\n' + acts : ''}`
    }).join('\n')
  }
  return pkg.Day_Wise_Itinerary || ''
}

export async function GET() {
  try {
    const snap = await getDocs(collection(db, 'packages'))
    const results: any[] = []

    snap.forEach(docSnap => {
      const p = docSnap.data() as any
      const destination = getDestination(p.Destination_ID || '')
      if (!destination) return   // skip non-target destinations

      const { days, nights } = parseDuration(p)
      const highlights = parseList(p.Highlights).length > 0
        ? parseList(p.Highlights)
        : parseList(p.Location_Breakup)

      results.push({
        basePackageId: docSnap.id,
        // Destination_Name IS the package title in this schema
        title: p.Destination_Name || `${destination} Package — ${nights}N ${days}D`,
        destination,
        destinationCountry: 'India',
        overview: p.Overview || '',
        durationDays: days,
        durationNights: nights,
        pricePerPerson: parsePrice(p),
        maxGroupSize: 20,
        minGroupSize: 1,
        travelType: p.Travel_Type || 'Leisure',
        theme: p.Theme || '',
        mood: p.Mood || '',
        starCategory: p.Star_Category || '3-Star',
        inclusions: parseList(p.Inclusions),
        exclusions: parseList(p.Exclusions),
        highlights,
        dayWiseItinerary: buildItinerary(p),
        primaryImageUrl: cleanUrl(p.Primary_Image_URL || ''),
        seasonalAvailability: p.Seasonality || 'Year Round',
        hotels: [],
      })
    })

    return NextResponse.json({ success: true, packages: results, count: results.length })
  } catch (error: any) {
    console.error('[Import Packages]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
