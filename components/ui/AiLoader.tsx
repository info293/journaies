'use client'

import { useEffect, useState } from 'react'

export default function AiLoader() {
    const [messageIndex, setMessageIndex] = useState(0)

    const messages = [
        "Analyzing destination details...",
        "Curating your personalized itinerary...",
        "Optimizing travel route...",
        "Finalizing your experience...",
        "Generating PDF document..."
    ]

    useEffect(() => {
        const interval = setInterval(() => {
            setMessageIndex((prev) => (prev + 1) % messages.length)
        }, 2000)

        return () => clearInterval(interval)
    }, [])

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md">
            <div className="flex flex-col items-center justify-center space-y-8 p-8">

                {/* Animated Core */}
                <div className="relative w-32 h-32 flex items-center justify-center">
                    {/* Outer Ring */}
                    <div className="absolute inset-0 border-4 border-t-primary border-r-transparent border-b-primary/30 border-l-transparent rounded-full animate-spin" />

                    {/* Middle Ring (Reverse Spin) */}
                    <div className="absolute inset-4 border-4 border-t-transparent border-r-white/50 border-b-transparent border-l-white/50 rounded-full animate-[spin_3s_linear_infinite_reverse]" />

                    {/* Inner Pulsing Core with Logo */}
                    <div className="absolute inset-8 bg-white rounded-full flex items-center justify-center animate-pulse shadow-[0_0_30px_rgba(124,58,237,0.3)]">
                        <img
                            src="/images/logo/Travelzada Logo April (1).png"
                            alt="Journaies"
                            className="w-16 h-auto object-contain"
                        />
                    </div>

                    {/* Orbiting Dot */}
                    <div className="absolute inset-0 animate-[spin_2s_linear_infinite]">
                        <div className="h-3 w-3 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)] absolute -top-1.5 left-1/2 -translate-x-1/2" />
                    </div>
                </div>

                {/* Text Content */}
                <div className="text-center space-y-3 max-w-sm">
                    <h3 className="text-2xl font-bold text-white tracking-wider animate-pulse">
                        AI PROCESSING
                    </h3>

                    <div className="h-6 overflow-hidden relative">
                        <p className="text-gray-300 text-sm font-medium tracking-wide animate-[fade-in-up_0.5s_ease-out] key={messageIndex}">
                            {messages[messageIndex]}
                        </p>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="w-64 h-1 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary via-purple-400 to-primary w-full animate-[shimmer_2s_infinite_linear] -translate-x-full" />
                </div>

            </div>

            {/* CSS for custom animations if not in tailwind config */}
            <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes fade-in-up {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
        </div>
    )
}
