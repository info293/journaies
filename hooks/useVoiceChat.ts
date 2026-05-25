'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

interface UseVoiceChatOptions {
    onTranscript?: (text: string) => void
    onError?: (error: string) => void
    language?: string
}

interface UseVoiceChatReturn {
    isListening: boolean
    isSpeaking: boolean
    transcript: string
    startListening: () => void
    stopListening: () => void
    speakText: (text: string) => Promise<void>
    stopSpeaking: () => void
    isSupported: boolean
}

export function useVoiceChat(options: UseVoiceChatOptions = {}): UseVoiceChatReturn {
    const { onTranscript, onError, language = 'en-IN' } = options

    const [isListening, setIsListening] = useState(false)
    const [isSpeaking, setIsSpeaking] = useState(false)
    const [transcript, setTranscript] = useState('')
    const [isSupported, setIsSupported] = useState(false)

    const recognitionRef = useRef<any>(null)
    const audioRef = useRef<HTMLAudioElement | null>(null)

    // Check browser support on mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
            setIsSupported(!!SpeechRecognition)
        }
    }, [])

    // Initialize speech recognition
    const initRecognition = useCallback(() => {
        if (typeof window === 'undefined') return null

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        if (!SpeechRecognition) return null

        const recognition = new SpeechRecognition()
        recognition.continuous = false
        recognition.interimResults = true
        recognition.lang = language

        recognition.onresult = (event: any) => {
            let finalTranscript = ''
            let interimTranscript = ''

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript
                if (event.results[i].isFinal) {
                    finalTranscript += transcript
                } else {
                    interimTranscript += transcript
                }
            }

            const currentTranscript = finalTranscript || interimTranscript
            setTranscript(currentTranscript)

            if (finalTranscript) {
                onTranscript?.(finalTranscript)
            }
        }

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error)
            setIsListening(false)
            if (event.error === 'not-allowed') {
                onError?.('Microphone access denied. Please enable microphone permissions.')
            } else {
                onError?.(`Speech recognition error: ${event.error}`)
            }
        }

        recognition.onend = () => {
            setIsListening(false)
        }

        return recognition
    }, [language, onTranscript, onError])

    // Start listening
    const startListening = useCallback(() => {
        if (!isSupported) {
            onError?.('Speech recognition is not supported in this browser.')
            return
        }

        // Stop any ongoing speech
        if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current = null
            setIsSpeaking(false)
        }

        const recognition = initRecognition()
        if (!recognition) return

        recognitionRef.current = recognition
        setTranscript('')
        setIsListening(true)

        try {
            recognition.start()
        } catch (error) {
            console.error('Failed to start recognition:', error)
            setIsListening(false)
        }
    }, [isSupported, initRecognition, onError])

    // Stop listening
    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop()
            recognitionRef.current = null
        }
        setIsListening(false)
    }, [])

    // Speak text using TTS API
    const speakText = useCallback(async (text: string) => {
        if (!text) return

        // Stop any ongoing speech
        if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current = null
        }

        setIsSpeaking(true)

        try {
            // Clean markdown and special characters for better speech
            const cleanText = text
                .replace(/\*\*/g, '')
                .replace(/\*/g, '')
                .replace(/#{1,6}\s/g, '')
                .replace(/`/g, '')
                .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert markdown links
                .replace(/₹/g, 'rupees ')
                .replace(/•/g, '')
                .trim()

            const response = await fetch('/api/ai-planner/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: cleanText }),
            })

            if (!response.ok) {
                throw new Error('Failed to generate speech')
            }

            const audioBlob = await response.blob()
            const audioUrl = URL.createObjectURL(audioBlob)

            const audio = new Audio(audioUrl)
            audioRef.current = audio

            audio.onended = () => {
                setIsSpeaking(false)
                URL.revokeObjectURL(audioUrl)
                audioRef.current = null
            }

            audio.onerror = () => {
                setIsSpeaking(false)
                URL.revokeObjectURL(audioUrl)
                audioRef.current = null
                onError?.('Failed to play audio')
            }

            await audio.play()
        } catch (error) {
            console.error('TTS error:', error)
            setIsSpeaking(false)
            onError?.('Failed to generate or play speech')
        }
    }, [onError])

    // Stop speaking
    const stopSpeaking = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current = null
        }
        setIsSpeaking(false)
    }, [])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop()
            }
            if (audioRef.current) {
                audioRef.current.pause()
            }
        }
    }, [])

    return {
        isListening,
        isSpeaking,
        transcript,
        startListening,
        stopListening,
        speakText,
        stopSpeaking,
        isSupported,
    }
}
