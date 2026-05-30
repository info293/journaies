export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: Request) {
    if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json(
            { error: 'No AI API keys configured' },
            { status: 500 }
        )
    }

    try {
        const { mainDestination, itinerary } = await request.json()

        if (!itinerary || !Array.isArray(itinerary)) {
            return NextResponse.json({ error: 'Itinerary is required' }, { status: 400 })
        }

        // Prepare prompt
        const prompt = `You are a geographic coordinate extractor.
Given the main destination of a trip and a list of daily itinerary descriptions:
1. Find the exact latitude and longitude for the primary international airport serving the "Main Destination".
2. Find the exact latitude and longitude for each specific real-world location in the "Itinerary Items".

Main Destination: ${mainDestination}

Itinerary Items:
${itinerary.map((i, idx) => `${idx + 1}. Day: ${i.day || ''} | Description: ${i.title}`).join('\n') || 'None'}

Format your response strictly as JSON matching the schema. The locations array must match the exact number and order of the Itinerary Items.`

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are a precise geocoding AI." },
                { role: "user", content: prompt }
            ],
            response_format: {
                type: "json_schema",
                json_schema: {
                    name: "geocoded_itinerary",
                    strict: true,
                    schema: {
                        type: "object",
                        properties: {
                            mainDestinationAirport: {
                                type: "object",
                                properties: { lat: { type: "number" }, lng: { type: "number" } },
                                required: ["lat", "lng"],
                                additionalProperties: false
                            },
                            locations: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: { lat: { type: "number" }, lng: { type: "number" } },
                                    required: ["lat", "lng"],
                                    additionalProperties: false
                                }
                            }
                        },
                        required: ["mainDestinationAirport", "locations"],
                        additionalProperties: false
                    }
                }
            },
            temperature: 0.1
        })

        const responseContent = completion.choices[0].message.content

        if (!responseContent) {
            throw new Error("No content returned from AI")
        }

        const data = JSON.parse(responseContent)

        // Convert array to Record matching the requested IDs
        const coordinatesMap: Record<string, [number, number]> = {}

        if (mainDestination && data.mainDestinationAirport?.lat !== undefined) {
            coordinatesMap[mainDestination] = [data.mainDestinationAirport.lat, data.mainDestinationAirport.lng]
        }

        if (data.locations && Array.isArray(data.locations)) {
            data.locations.forEach((loc: any, index: number) => {
                // We match by the index of the incoming itinerary array for safety
                const originalItem = itinerary[index]
                if (originalItem && originalItem.title) {
                    coordinatesMap[originalItem.title] = [loc.lat, loc.lng]
                }
            })
        }

        return NextResponse.json({ coordinates: coordinatesMap })

    } catch (error: any) {
        console.error('Error in geocode-itinerary API:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to geocode itinerary' },
            { status: 500 }
        )
    }
}
