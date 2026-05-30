export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

const SYSTEM_PROMPT = `You are a travel itinerary analyzer.

Your task is to extract ALL VALID pickup and drop point combinations from a package itinerary.

A pickup/drop point is ONLY the ARRIVAL or DEPARTURE transport hub mentioned on:
- Day 1 (pickup)
- Final Day / Last Day (drop)

These are usually:
- Airports
- Railway stations
- Major arrival/departure cities

-----------------------------------
PICKUP CITY RULES
-----------------------------------

Pickup city = the place where the traveler ARRIVES and the tour BEGINS.

Look ONLY at Day 1.

Identify phrases such as:
- "Arrival at X Airport"
- "Received at X"
- "Pickup from X"
- "Meet & greet at X"
- "Upon arrival at X"
- "Tour starts from X"

IMPORTANT:
The pickup is NOT the destination city they are transferred to afterward.

Examples:
- "Upon arrival at Bagdogra Airport, drive to Gangtok"
  → pickup = "Bagdogra"

- "Arrival at Delhi Airport and transfer to Agra"
  → pickup = "Delhi"

- "Pickup from NJP Railway Station / Bagdogra Airport"
  → pickups = "NJP" AND "Bagdogra"

-----------------------------------
DROP CITY RULES
-----------------------------------

Drop city = the FINAL departure point where the tour ENDS.

Look ONLY at the LAST DAY / FINAL DAY.

Identify phrases such as:
- "Transfer to X Airport"
- "Drop at X"
- "Departure from X"
- "Tour ends at X"
- "Fly back from X"
- "Board train/flight from X"

Examples:
- "Transfer to Bagdogra Airport for onward journey"
  → drop = "Bagdogra"

- "Drop at NJP Railway Station"
  → drop = "NJP"

-----------------------------------
VERY IMPORTANT LOGIC
-----------------------------------

You MUST extract ALL pickup points mentioned on Day 1 and ALL drop points mentioned on the final day.

Then generate ALL VALID combinations.

Example:
Day 1:
- Pickup from Bagdogra Airport OR NJP Railway Station

Last Day:
- Drop at Bagdogra Airport OR NJP Railway Station

Output:
[
  {"pickup":"Bagdogra","drop":"Bagdogra"},
  {"pickup":"Bagdogra","drop":"NJP"},
  {"pickup":"NJP","drop":"Bagdogra"},
  {"pickup":"NJP","drop":"NJP"}
]

-----------------------------------
STRICT RULES
-----------------------------------

- Use ONLY short city/location names
- Do NOT include:
  - hotel cities
  - sightseeing places
  - transit stops
  - transfer destinations
- Ignore phrases like:
  - "drive to"
  - "overnight stay at"
  - "visit"
- Focus ONLY on actual arrival/departure hubs

-----------------------------------
OUTPUT FORMAT
-----------------------------------

Return ONLY a raw JSON array.

Format:
[
  {"pickup":"City","drop":"City"}
]

No explanation.
No markdown.
No extra text.`

export async function POST(req: Request) {
  try {
    const { itineraries } = await req.json()

    if (!Array.isArray(itineraries) || itineraries.length === 0) {
      return NextResponse.json({ pairs: [] })
    }

    if (!anthropic && !openai) {
      return NextResponse.json({ pairs: [] }, { status: 500 })
    }

    const combinedText = itineraries
      .filter(Boolean)
      .map((s: string, i: number) => `--- Package ${i + 1} ---\n${s}`)
      .join('\n\n')

    const userContent = `For each package below, find the pickup (start) city and drop (end) city:\n\n${combinedText}`

    let raw = '[]'

    if (anthropic) {
      try {
        const response = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 768,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userContent }],
        })
        raw = (response.content.find(b => b.type === 'text') as any)?.text?.trim() || '[]'
      } catch (err: any) {
        console.warn('[extract-pickup-drop] Claude failed, falling back to GPT-4o:', err?.message)
      }
    }

    if (raw === '[]' && openai) {
      console.log('[extract-pickup-drop] Using GPT-4o fallback')
      const res = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 768,
        temperature: 0.1,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
      })
      raw = res.choices[0]?.message?.content?.trim() || '[]'
    }
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    let pairs: { pickup: string; drop: string }[] = []

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      if (Array.isArray(parsed)) {
        pairs = parsed
          .filter((p: any) => p && typeof p.pickup === 'string' && typeof p.drop === 'string')
          .map((p: any) => ({
            pickup: p.pickup.trim(),
            drop: p.drop.trim(),
          }))
          .filter((p: any) =>
            p.pickup.length > 1 && p.pickup.length < 50 &&
            p.drop.length > 1 && p.drop.length < 50 &&
            !p.pickup.includes(',') && !p.drop.includes(',') &&
            !/^(breakfast|lunch|dinner|departure|arrival|check|hotel|transfer|drive|fly|en route)/i.test(p.pickup) &&
            !/^(breakfast|lunch|dinner|departure|arrival|check|hotel|transfer|drive|fly|en route)/i.test(p.drop)
          )
      }
    }

    return NextResponse.json({ pairs })
  } catch (err: any) {
    console.error('[extract-pickup-drop] Error:', err?.message || err)
    return NextResponse.json({ pairs: [] }, { status: 500 })
  }
}
