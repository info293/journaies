export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { db } from '@/lib/firebase'
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'
import { logApiError } from '@/lib/api-logger'

const anthropic = process.env.ANTHROPIC_API_KEY
    ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    : null

const openai = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null

// ── DMC server-side helpers ──────────────────────────────────────────────────

function pkgHasHotel(starCategory: string): boolean {
    const star = (starCategory || '').trim().toLowerCase()
    return !!star && star !== 'none'
}

// Extract the text content of a specific day section from an itinerary string.
function getDaySection(itinerary: string, dayNum: number): string {
    const lower = itinerary.toLowerCase()
    const pattern = new RegExp(`day\\s*0?${dayNum}[\\s:–\\-]`, 'i')
    const match = lower.match(pattern)
    if (!match || match.index === undefined) return ''
    const start = match.index
    const nextPattern = new RegExp(`day\\s*0?${dayNum + 1}[\\s:–\\-]`, 'i')
    const nextMatch = lower.substring(start + 5).match(nextPattern)
    const end = nextMatch?.index !== undefined ? start + 5 + nextMatch.index : start + 700
    return lower.substring(start, end)
}

function getFirstDayContent(itinerary: string): string {
    return getDaySection(itinerary, 1) || itinerary.toLowerCase().substring(0, 500)
}

function getLastDayContent(itinerary: string): string {
    const lower = itinerary.toLowerCase()
    const allMatches = [...lower.matchAll(/day\s*0?(\d+)[\s:–\-]/gi)]
    if (allMatches.length === 0) return lower.substring(Math.max(0, lower.length - 500))
    const lastMatch = allMatches[allMatches.length - 1]
    return lower.substring(lastMatch.index ?? 0)
}

function applyDmcFilters(packages: any[], wizardData: any): any[] {
    let pkgs = [...packages]

    const includedCities: string[] = wizardData.includedCities || []
    const hotelIncluded: boolean | null = wizardData.hotelIncluded ?? null
    const hotelTypes: string[] = wizardData.hotelTypes || []
    const selectedNights: number = wizardData.routeItems?.[0]?.nights || 0
    const pickupCity: string = wizardData.pickupCity || ''
    const dropCity: string = wizardData.dropCity || ''

    // 1. City filter — itinerary must mention at least one selected city
    if (includedCities.length > 0) {
        pkgs = pkgs.filter(pkg => {
            const itin = (pkg.Day_Wise_Itinerary || '').toLowerCase()
            return includedCities.some((c: string) => itin.includes(c.toLowerCase()))
        })
        console.log(`[AI Planner] After city filter (${includedCities.join(', ')}): ${pkgs.length} packages`)
    }

    // 2. Hotel filter — use Star_Category field (same as StepDmc2Cities logic)
    if (hotelIncluded === false) {
        pkgs = pkgs.filter(pkg => !pkgHasHotel(pkg.Star_Category))
        console.log(`[AI Planner] After "without hotel" filter: ${pkgs.length} packages`)
    } else if (hotelIncluded === true) {
        pkgs = pkgs.filter(pkg => pkgHasHotel(pkg.Star_Category))
        if (hotelTypes.length > 0) {
            pkgs = pkgs.filter(pkg => {
                const star = (pkg.Star_Category || '').toLowerCase()
                return hotelTypes.some((t: string) => star === t.toLowerCase())
            })
            console.log(`[AI Planner] After star category filter (${hotelTypes.join(', ')}): ${pkgs.length} packages`)
        } else {
            console.log(`[AI Planner] After "with hotel" filter: ${pkgs.length} packages`)
        }
    }

    // 3. Duration filter — exact match first, then ±1 fallback
    if (selectedNights > 0) {
        const exact = pkgs.filter(pkg => Number(pkg.Duration_Nights) === selectedNights)
        if (exact.length > 0) {
            pkgs = exact
            console.log(`[AI Planner] After exact nights filter (${selectedNights}N): ${pkgs.length} packages`)
        } else {
            const near = pkgs.filter(pkg => Math.abs(Number(pkg.Duration_Nights) - selectedNights) <= 1)
            if (near.length > 0) {
                pkgs = near
                console.log(`[AI Planner] After ±1 nights fallback (${selectedNights}N): ${pkgs.length} packages`)
            }
        }
    }

    // 4. Pickup city — check only Day 1 of the itinerary so a city mentioned only
    //    at departure (last day) doesn't incorrectly satisfy the pickup constraint.
    if (pickupCity) {
        const pickupFiltered = pkgs.filter(pkg => {
            const day1 = getFirstDayContent(pkg.Day_Wise_Itinerary || '')
            return day1.includes(pickupCity.toLowerCase())
        })
        if (pickupFiltered.length > 0) {
            pkgs = pickupFiltered
            console.log(`[AI Planner] After pickup city filter (${pickupCity}): ${pkgs.length} packages`)
        } else {
            console.log(`[AI Planner] Pickup city filter (${pickupCity}) matched 0 — skipping (soft filter)`)
        }
    }

    // 5. Drop city — check only the last day of the itinerary (soft filter)
    if (dropCity) {
        const dropFiltered = pkgs.filter(pkg => {
            const lastDay = getLastDayContent(pkg.Day_Wise_Itinerary || '')
            return lastDay.includes(dropCity.toLowerCase())
        })
        if (dropFiltered.length > 0) {
            pkgs = dropFiltered
            console.log(`[AI Planner] After drop city filter (${dropCity}): ${pkgs.length} packages`)
        } else {
            console.log(`[AI Planner] Drop city filter (${dropCity}) matched 0 — skipping (soft filter)`)
        }
    }

    return pkgs
}

// ────────────────────────────────────────────────────────────────────────────

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
    // Try Claude first
    if (anthropic) {
        try {
            console.log('[AI Planner] 🤖 Using Claude (Anthropic) for package matching...')
            const res = await anthropic.messages.create({
                model: 'claude-sonnet-4-5-20250929',
                max_tokens: 2048,
                system: systemPrompt,
                messages: [{ role: 'user', content: userPrompt }],
                temperature: 0.1,
            })
            const text = (res.content.find(b => b.type === 'text') as any)?.text?.trim() || '[]'
            console.log('[AI Planner] ✅ Claude responded successfully.')
            return text
        } catch (err: any) {
            console.warn('[AI Planner] ⚠️  Claude failed:', err?.message || err)
            console.log('[AI Planner] 🔄 Falling back to OpenAI (ChatGPT)...')
        }
    }

    // Fallback to OpenAI
    if (openai) {
        console.log('[AI Planner] 🤖 Using OpenAI (ChatGPT) for package matching...')
        const res = await openai.chat.completions.create({
            model: 'gpt-4o',
            max_tokens: 2048,
            temperature: 0.1,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
        })
        const text = res.choices[0]?.message?.content?.trim() || '[]'
        console.log('[AI Planner] ✅ OpenAI responded successfully.')
        return text
    }

    throw new Error('No AI provider is configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.')
}

export async function POST(request: Request) {
    if (!anthropic && !openai) {
        return NextResponse.json(
            { error: 'No AI provider configured.' },
            { status: 500 }
        )
    }

    try {
        const body = await request.json()
        // agentSlug is optional — if present, scope to that agent's packages only
        const { agentSlug, ...wizardData } = body

        console.log('\n--- [AI Planner] NEW TAILORED TRAVEL REQUEST ---')
        console.log('[AI Planner] Agent Slug:', agentSlug || '(none — using main packages)')
        console.log('[AI Planner] Received User Preferences:', JSON.stringify(wizardData, null, 2))

        if (!wizardData || !wizardData.destinations || wizardData.destinations.length === 0) {
            console.warn('[AI Planner] Rejecting request: No destinations provided.')
            return NextResponse.json(
                { error: 'No destinations provided.' },
                { status: 400 }
            )
        }

        const requestedDestinations = wizardData.destinations.map((d: string) => {
            let normalized = d.toLowerCase();
            if (normalized.includes('andaman')) return 'andaman';
            if (normalized.includes('sri lanka') || normalized.includes('sri-lanka')) return 'sri lanka';
            return normalized;
        })
        console.log('[AI Planner] Requested Destinations:', requestedDestinations)

        let allPackages: any[] = []

        if (agentSlug) {
            // --- AGENT MODE: fetch from agent_packages scoped to this agent ---
            console.log(`[AI Planner] Agent mode: fetching packages for slug "${agentSlug}"`)

            // Look up agent by slug
            const agentsRef = collection(db, 'agents')
            const agentQ = query(agentsRef, where('agentSlug', '==', agentSlug), where('status', '==', 'active'))
            const agentSnap = await getDocs(agentQ)

            if (agentSnap.empty) {
                return NextResponse.json({ error: 'Agent not found or not active.' }, { status: 404 })
            }

            const agentDoc = agentSnap.docs[0]
            const agentId = agentDoc.id
            const agentData = agentDoc.data()
            const pricingConfig: Record<string, { markupPercent: number; showInINR: boolean }> =
                agentData.pricingConfig ?? {}

            // Fetch agent's packages
            const agentPkgRef = collection(db, 'agent_packages')
            const agentPkgQ = query(
                agentPkgRef,
                where('agentId', '==', agentId),
                where('isActive', '==', true)
            )
            const agentPkgSnap = await getDocs(agentPkgQ)

            agentPkgSnap.forEach(d => {
                const data = d.data()
                console.log(`[AI Planner] Package "${data.title}" — pricePerPerson:${data.pricePerPerson}, totalPrice:${data.totalPrice}, gst:${data.gst}`)
                if (
                    data.destination &&
                    requestedDestinations.some((dest: string) =>
                        data.destination.toLowerCase().trim() === dest.trim()
                    )
                ) {
                    // Determine whether to show price in INR based on the Pricing page config.
                    // The key matches the one used in PricingManager: `${country}|||${currency}`.
                    const pkgCurrency = data.currency || 'INR'
                    const pricingKey = `${data.destinationCountry}|||${pkgCurrency}`
                    const showInINR = pricingConfig[pricingKey]?.showInINR ?? false

                    // Recover the effective exchange rate from priceInINR saved at edit time.
                    // priceInINR = (pricePerPerson || totalPrice) * effectiveRate.
                    // Guard: if priceInINR is 0 (old package not yet re-saved), don't convert —
                    // that would produce ₹0. The package must be re-saved once to populate it.
                    const localBase = data.pricePerPerson || data.totalPrice || 0
                    const storedINR = data.priceInINR || 0
                    const hasValidRate = pkgCurrency !== 'INR' && storedINR > 0 && localBase > 0
                    const convertToINR = showInINR && hasValidRate
                    const inrPerUnit = hasValidRate ? storedINR / localBase : 1

                    const displayPricePerPerson = convertToINR
                        ? Math.round((data.pricePerPerson || 0) * inrPerUnit)
                        : (data.pricePerPerson || 0)
                    const displayTotalPrice = data.totalPrice != null
                        ? (convertToINR ? Math.round(data.totalPrice * inrPerUnit) : data.totalPrice)
                        : null

                    allPackages.push({
                        id: d.id,
                        source: 'agent',
                        Destination_ID: d.id,
                        Slug: '',
                        Destination_Name: data.destination,
                        Destination_Country: data.destinationCountry || '',
                        Overview: data.overview || '',
                        Duration_Days: data.durationDays || 0,
                        Duration_Nights: data.durationNights || 0,
                        Price_Min_INR: displayPricePerPerson || displayTotalPrice || 0,
                        totalPrice: displayTotalPrice,
                        gst: data.gst ?? null,
                        Travel_Type: data.travelType || '',
                        Mood: data.mood || '',
                        Star_Category: data.starCategory || '',
                        Theme: data.theme || '',
                        Primary_Image_URL: data.primaryImageUrl || '',
                        Day_Wise_Itinerary: data.dayWiseItinerary || '',
                        Day_Wise_Itinerary_Details: [],
                        Inclusions: Array.isArray(data.inclusions) ? data.inclusions : (data.inclusions || ''),
                        Exclusions: Array.isArray(data.exclusions) ? data.exclusions : (data.exclusions || ''),
                        Highlights: Array.isArray(data.highlights) ? data.highlights : [],
                        Hotels: Array.isArray(data.hotels) ? data.hotels : [],
                        Vehicles: Array.isArray(data.vehicles) ? data.vehicles : [],
                        PaymentPolicy: data.paymentPolicy || '',
                        CancellationPolicy: data.cancellationPolicy || '',
                        Currency: convertToINR ? 'INR' : pkgCurrency,  // INR only when rate is valid
                        // Agent-specific extras
                        agentPackageTitle: data.title || data.destination,
                        agentId,
                        agentSlug,
                    })
                }
            })

            console.log(`[AI Planner] Found ${allPackages.length} matching agent packages.`)

            // Apply DMC wizard filters server-side (cities, hotel, nights, pickup)
            if (allPackages.length > 0) {
                const filtered = applyDmcFilters(allPackages, wizardData)
                if (filtered.length > 0) {
                    allPackages = filtered
                    console.log(`[AI Planner] After DMC pre-filters: ${allPackages.length} packages will be sent to AI.`)
                } else {
                    console.log('[AI Planner] DMC pre-filters returned 0 results — keeping all packages as fallback.')
                }
            }

            // Fallback to main packages only if agent explicitly allows it
            if (allPackages.length === 0 && agentData.fallbackToTravelzada === true) {
                console.log('[AI Planner] No agent packages matched. Falling back to Travelzada main packages.')
                allPackages = await fetchMainPackages(requestedDestinations)
            } else if (allPackages.length === 0) {
                console.log('[AI Planner] No agent packages matched and fallback is disabled.')
                return NextResponse.json({ success: true, packages: [], noAgentPackages: true })
            }
        } else {
            // --- MAIN SITE MODE: fetch from main packages collection ---
            allPackages = await fetchMainPackages(requestedDestinations)
        }

        console.log(`[AI Planner] Fetched ${allPackages.length} eligible packages.`)

        if (allPackages.length === 0) {
            console.log('[AI Planner] No matching packages found.')
            return NextResponse.json({ success: true, packages: [] })
        }

        // Build Claude prompts
        const isDmcMode = !!agentSlug
        const totalNights = wizardData.routeItems?.reduce((acc: number, item: any) => acc + (item.nights || 0), 0) || 0

        // DMC-specific filter context
        const includedCities: string[] = wizardData.includedCities || []
        const hotelIncluded: boolean | null = wizardData.hotelIncluded ?? null
        const hotelTypes: string[] = wizardData.hotelTypes || []
        const pickupCity: string = wizardData.pickupCity || ''
        const dropCity: string = wizardData.dropCity || ''
        const groupSize = wizardData.groupSize || {}

        const hotelLabel = hotelIncluded === true
            ? `With Hotel — ${hotelTypes.length > 0 ? hotelTypes.join(', ') : 'any star category'}`
            : hotelIncluded === false
                ? 'Without Hotel (no star category / land only)'
                : 'Not specified'

        const dmcRequirements = isDmcMode ? `
Cities Required in Itinerary: ${includedCities.length > 0 ? includedCities.join(', ') : 'Any'}
Hotel Preference: ${hotelLabel}
Pickup City: ${pickupCity || 'Not specified'}
Drop City: ${dropCity || 'Not specified'}
Group Size: ${groupSize.adults || 2} Adults, ${groupSize.children || 0} Children, ${groupSize.infants || 0} Infants` : ''

        const systemPrompt = isDmcMode
            ? `You are a travel package matcher for a DMC (tour operator) AI planner.
The packages provided have ALREADY been pre-filtered on the server to match the user's hard requirements (cities, hotel type, nights).
Your job is to rank these pre-filtered packages and return the top 3 best matches in strict JSON format.

SCORING RULES (start at 100 for each package):
1. Duration Match (CRITICAL): Requested duration is a hard preference.
   - Exact nights match: 0 deduction.
   - ±1 night difference: Deduct 5 points.
   - More than 1 night off: Deduct 25 points.
2. Hotel / Star Category (HIGH): Must align with the stated hotel preference.
   - Perfect star category match: 0 deduction.
   - Same hotel tier (with/without) but different star: Deduct 10 points.
   - Wrong hotel tier (with vs without): Deduct 30 points.
3. Cities Covered (HIGH): Package itinerary should cover the requested cities.
   - All cities present: 0 deduction.
   - Missing some cities: Deduct 5–15 points.
4. Pickup/Drop alignment (MEDIUM): If pickup/drop city specified, package should start/end there.
   - Matches: 0 deduction. Doesn't match: Deduct 5 points.
5. Group suitability, mood, vibe (LOW): Deduct 2–5 points for mismatches.

INSTRUCTIONS:
- Rank packages by matchScore descending, return top 3.
- Write a clear 1-2 sentence matchReason mentioning star category, nights, and cities covered.
- The matchReason must ONLY highlight what the package offers and what aligns with the user's request. NEVER mention anything negative, missing, wrong, or that doesn't match — no words like "doesn't", "missing", "lacks", "only", "unfortunately", "however", "but", "although", "except", "without", "not", "no", "short", "less than". Focus entirely on positive highlights.
- Return ONLY a raw JSON array — no markdown, no code blocks.
- Format:
[
  {
    "id": "package_id_here",
    "matchScore": 95,
    "matchReason": "Exact match: 7 nights, 4-star hotels, covering Jaipur, Jodhpur and Jaisalmer."
  }
]`
            : `You are a luxury travel curator AI for Travelzada.
Your job is to evaluate a list of available travel packages against a user's highly specific "Tailored Travel" preferences, and return the top 3 best matching packages in strict JSON format.

EVALUATION CRITERIA SCORING SYSTEM (Start with Base Score: 100 for each package):
Priority 1 - Destination Match (CRITICAL): The destination MUST match. If the destination does not match, the score is 0. Do not include it.
Priority 2 - Duration Match (HIGH): The package duration MUST match the Requested Duration in nights.
   - Exact match: Deduct 0 points.
   - Exactly 1 night less (Fallback): Deduct 5 points.
   - Any other duration mismatch: Deduct 30 points.
Priority 3 - Hotel / Star Category (MEDIUM): The package's star category should match the user's requested Hotel Preference.
   - If Star Category does NOT match: Deduct 15 points.
Priority 4 - Vibes/Experiences & Group Type (LOW):
   - Deduct 2 to 5 points for mismatches in vibe, experiences, or group type.

INSTRUCTIONS:
- Analyze the User Preferences thoroughly against the Available Packages.
- Calculate the "matchScore" (0-100) for each package by starting at 100 and applying the deductions strictly in order of priority above.
- Sort the packages by matchScore in descending order, and retrieve the top 3.
- Provide a brief 1-2 sentence "matchReason" explaining exactly why this package was selected, explicitly mentioning the star category, vibe, and duration.
- The matchReason must ONLY highlight what the package offers and what aligns with the user's request. NEVER mention anything negative, missing, wrong, or that doesn't match — no words like "doesn't", "missing", "lacks", "only", "unfortunately", "however", "but", "although", "except", "without", "not", "no", "short", "less than". Focus entirely on positive highlights.
- Return ONLY valid JSON.
- DO NOT wrap the JSON in markdown blocks like \`\`\`json. Just output the raw JSON array.
- The JSON structure MUST exactly match this format:
[
  {
    "id": "package_id_here",
    "matchScore": 95,
    "matchReason": "This package perfectly matches your request for a luxury 5-star relaxing experience."
  }
]`

        const userPrompt = isDmcMode
            ? `
=== USER REQUIREMENTS (DMC WIZARD SELECTIONS) ===
Destination: ${wizardData.destinations.join(', ')}
Travel Date: ${wizardData.dateRange || 'Flexible'}
Requested Duration: ${totalNights > 0 ? totalNights + ' Nights (EXACT MATCH PREFERRED)' : 'Flexible'}${dmcRequirements}

=== PRE-FILTERED PACKAGES (${allPackages.length} packages matching hard criteria) ===
${JSON.stringify(allPackages.map(p => ({
    id: p.id,
    title: p.agentPackageTitle || p.Destination_Name,
    nights: p.Duration_Nights,
    days: p.Duration_Days,
    star_category: p.Star_Category,
    travel_type: p.Travel_Type,
    mood: p.Mood,
    price_per_person: p.Price_Min_INR,
    overview: p.Overview || '',
    inclusions: p.Inclusions || '',
    exclusions: p.Exclusions || '',
    highlights: p.Highlights || [],
    hotels: p.Hotels || [],
    day_wise_itinerary: p.Day_Wise_Itinerary || '',
})), null, 2)}

Rank these packages and return the top 3 best matches.`
            : `
=== USER PREFERENCES ===
Destinations: ${wizardData.destinations.join(', ')}
Date Range: ${wizardData.dateRange}
Requested Duration: ${totalNights > 0 ? totalNights + ' Nights' : 'Flexible'}
Vibe/Experiences: ${(wizardData.experiences || []).join(', ')}
Group Type: ${wizardData.groupType || 'couple'}
Hotel Preference: ${(wizardData.hotelTypes || []).join(', ')}
Travelers: ${wizardData.passengers?.adults || 2} Adults, ${wizardData.passengers?.kids || 0} Kids
Rooms Required: ${wizardData.passengers?.rooms || 1}

=== AVAILABLE PACKAGES IN DATABASE ===
${JSON.stringify(allPackages, null, 2)}

Return the top matches in the requested JSON format.`

        console.log('[AI Planner] Determining best packages using AI...')

        const responseText = await callAI(systemPrompt, userPrompt)

        console.log('\n[AI Planner] Raw AI Response:')
        console.log(responseText)

        let matchedPackageIds: any[] = []
        try {
            const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim()
            matchedPackageIds = JSON.parse(cleanJson)
            console.log(`[AI Planner] Parsed ${matchedPackageIds.length} recommendations.`)
        } catch (e) {
            console.error("Failed to parse AI JSON response:", responseText)
            return NextResponse.json(
                { error: 'AI failed to return valid matches.' },
                { status: 500 }
            )
        }

        const finalResults = matchedPackageIds.map(match => {
            const fullPackageDetails = allPackages.find(p => p.id === match.id)
            if (fullPackageDetails) {
                return {
                    ...fullPackageDetails,
                    matchScore: match.matchScore,
                    matchReason: match.matchReason
                }
            }
            return null
        }).filter(Boolean)

        finalResults.sort((a, b) => b.matchScore - a.matchScore)

        console.log('[AI Planner] Processing Complete! Returning', finalResults.length, 'packages.')

        return NextResponse.json({ success: true, packages: finalResults })

    } catch (error: any) {
        await logApiError('/api/tailored-travel/find-packages', 'POST', error)
        return NextResponse.json(
            { error: 'An error occurred while finding matches.' },
            { status: 500 }
        )
    }
}

async function fetchMainPackages(requestedDestinations: string[]) {
    const packagesRef = collection(db, 'packages')
    const querySnapshot = await getDocs(packagesRef)

    const result: any[] = []
    querySnapshot.forEach((docSnap) => {
        const data = docSnap.data()
        if (
            data.Destination_Name &&
            requestedDestinations.some((d: string) => data.Destination_Name.toLowerCase().includes(d))
        ) {
            let parsedPrice = 0
            const rawPrice = data.Price_Min_INR || data.Price_Range_INR || data.Price || data.budget || 0
            if (typeof rawPrice === 'number') {
                parsedPrice = rawPrice
            } else if (typeof rawPrice === 'string') {
                const numericOnly = rawPrice.replace(/[^0-9]/g, '')
                parsedPrice = parseInt(numericOnly, 10) || 0
            }

            result.push({
                id: docSnap.id,
                source: 'travelzada',
                Destination_ID: data.Destination_ID || '',
                Slug: data.Slug || '',
                Destination_Name: data.Destination_Name,
                Overview: data.Overview || '',
                Duration_Days: data.Duration_Days || 0,
                Duration_Nights: data.Duration_Nights || 0,
                Price_Min_INR: parsedPrice,
                Travel_Type: data.Travel_Type || '',
                Mood: data.Mood || '',
                Star_Category: data.Star_Category || '',
                Theme: data.Theme || '',
                Primary_Image_URL: data.Primary_Image_URL || '',
                Day_Wise_Itinerary: data.Day_Wise_Itinerary || '',
                Day_Wise_Itinerary_Details: data.Day_Wise_Itinerary_Details || [],
                Inclusions: data.Inclusions || ''
            })
        }
    })
    return result
}
