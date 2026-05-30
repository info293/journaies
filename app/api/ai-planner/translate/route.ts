export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(request: Request) {
    try {
        const { text, targetLanguage, targetLanguageName } = await request.json()

        if (!text || !targetLanguage) {
            return NextResponse.json({ error: 'text and targetLanguage are required' }, { status: 400 })
        }

        if (targetLanguage === 'en') {
            return NextResponse.json({ translated: text })
        }

        const res = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            max_tokens: 300,
            temperature: 0.1,
            messages: [
                {
                    role: 'system',
                    content: `You are a professional translator. Translate the given travel itinerary text to ${targetLanguageName || targetLanguage}. Return ONLY the translated text — no quotes, no explanations, nothing else.`,
                },
                { role: 'user', content: text },
            ],
        })

        const translated = res.choices[0]?.message?.content?.trim() || text
        return NextResponse.json({ translated })
    } catch (error: any) {
        console.error('[Translate] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
