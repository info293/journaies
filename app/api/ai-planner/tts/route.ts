export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: Request) {
    if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json(
            { error: 'Missing OPENAI_API_KEY' },
            { status: 500 }
        )
    }

    try {
        const { text } = await request.json()

        if (!text || typeof text !== 'string') {
            return NextResponse.json(
                { error: 'Text is required' },
                { status: 400 }
            )
        }

        // Limit text length to avoid high costs
        const truncatedText = text.slice(0, 4096)

        const mp3 = await openai.audio.speech.create({
            model: 'tts-1-hd',   // higher quality, supports 50+ languages automatically
            voice: 'nova',        // warm, clear voice — works well across languages
            input: truncatedText,
            response_format: 'mp3',
            speed: 0.85,          // slightly slower for clarity
        })

        // Get audio buffer
        const buffer = Buffer.from(await mp3.arrayBuffer())

        // Return audio as response
        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': buffer.length.toString(),
            },
        })
    } catch (error: any) {
        console.error('TTS API error:', error)
        return NextResponse.json(
            { error: 'Failed to generate speech' },
            { status: 500 }
        )
    }
}
