import OpenAI from 'openai'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

export interface AgentDecision {
    intent: 'SEARCH_PACKAGES' | 'GENERAL_CHAT' | 'CLARIFICATION'
    reasoning: string
    searchQuery: string // Optimized query for vector search
    filters: {
        budget?: { min?: number; max?: number }
        destination?: string
        theme?: string
        mood?: string
        duration?: { min: number; max: number }
        travelType?: string
        hotel?: { minStar?: number; category?: string }
    }
}

/**
 * The "Brain" of the Agent.
 * Decides WHAT the user wants and HOW to search for it.
 */
export async function detectUserIntent(
    lastMessage: string,
    history: any[],
    currentDestination?: string,
    wizardData?: any
): Promise<AgentDecision> {
    const systemPrompt = `
You are the "Brain" of a Travel Planner Agent.
Your job is to analyze the user's latest message and decide the next step.

*** CRITICAL MEMORY RULE ***
- You MUST scan the ENTIRE conversation history to understand the context.
- If the user asks a follow-up question (e.g., "luxury hotel", "birthday trip") but does NOT mention a destination, **LOOK BACK** in the history to find the destination they were talking about.
- If you find a destination in the history, use it and set the intent to **SEARCH_PACKAGES**.

AVAILABLE INTENTS:
1. SEARCH_PACKAGES: User is asking for a trip, destination, quote, or recommendation. **(DEFAULT if a destination is mentioned OR implied from history)**
2. GENERAL_CHAT: User is saying "Hi", "Thanks", or asking general questions like "Is Bali safe?".
3. CLARIFICATION: User provided vague info, AND NO DESTINATION IS FOUND IN HISTORY. (e.g. "I want to travel" -> Ask "Where?").

RULES FOR SEARCH:
- **If user mentions a destination (e.g. "Bali", "Kerala"), OR if the destination is in the HISTORY, ALWAYS choose SEARCH_PACKAGES.**
- Only use CLARIFICATION if the user hasn't specified WHERE they want to go, and it's NOT in the history.

EXTRACT FILTERS (If Intent is SEARCH_PACKAGES):
- Budget: Convert "under 50k" to { max: 50000 }. "Cheap" -> { max: 30000 }. "Luxury" -> { min: 100000 }.
- Destination: Normalized name (e.g. "Kerala"). IF NOT IN CURRENT MESSAGE, TAKE FROM HISTORY.
- Theme/Mood: Honeymoon, Adventure, Relaxing.

OUTPUT FORMAT:
Return a pure JSON object:
  "intent": "SEARCH_PACKAGES",
  "reasoning": "User asked for luxury hotel. History shows destination is Bali.",
  "searchQuery": "Bali luxury hotel",
  "filters": {
    "destination": "Bali",
    "theme": "Honeymoon",
    "budget": { "max": 100000 },
    "duration": { "min": 6, "max": 8 },
    "hotel": { "minStar": 5, "category": "Luxury" }
  }
}
${currentDestination ? `\n\n🎯 CURRENT WIZARD CONTEXT: The user is currently looking at results for **${currentDestination}**. YOU MUST ALWAYS CHOOSE SEARCH_PACKAGES if their query is about travel, and set the destination filter to ${currentDestination}.` : ''}
${wizardData ? `
📋 STRICT USER PREFERENCES FROM WIZARD FORM:
The user explicitly requested these vibes and preferences. ALWAYS use these preferences for generating search filters unless they explicitly contradict it in their immediate message:
- Vibes/Experiences: ${(wizardData.experiences || []).join(', ')}
- Group Type: ${wizardData.groupType || 'Not specified'}
- Hotel Preferences: ${(wizardData.hotelTypes || []).join(', ')}
` : ''}
`

    const messages = [
        { role: 'system', content: systemPrompt },
        // Include FULL history for context
        ...history.map((h: any) => ({
            role: h.role === 'user' ? 'user' : 'assistant',
            content: h.content,
        })),
        { role: 'user', content: lastMessage },
    ]

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o', // Fast and smart
            messages: messages as any,
            response_format: { type: 'json_object' },
            temperature: 0, // Deterministic
        })

        const content = response.choices[0].message.content || '{}'
        return JSON.parse(content) as AgentDecision
    } catch (error) {
        console.error('Agent Brain Error:', error)
        // Fallback to basic search
        return {
            intent: 'SEARCH_PACKAGES',
            reasoning: 'Fallback due to error',
            searchQuery: lastMessage,
            filters: {},
        }
    }
}
