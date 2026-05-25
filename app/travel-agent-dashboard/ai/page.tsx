'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { motion } from 'framer-motion'
import {
  Bot, Mic, MicOff, Volume2, Globe, Send, Loader2, Package,
  MapPin, Clock, ArrowUpRight, Star, Check, XCircle, Search,
  ChevronDown, ChevronLeft,
} from 'lucide-react'

interface AgentPackage {
  id: string
  title: string
  destination: string
  destinationCountry?: string
  durationNights: number
  durationDays: number
  pricePerPerson: number
  travelType: string
  starCategory: string
  primaryImageUrl?: string
  isActive: boolean
  overview?: string
  inclusions?: string[]
  exclusions?: string[]
  highlights?: string[]
  dayWiseItinerary?: string
  theme?: string
  mood?: string
}

const INDIAN_LANGUAGES = [
  { code: 'en-IN', label: 'English' },
  { code: 'hi-IN', label: 'हिंदी' },
  { code: 'bn-IN', label: 'বাংলা' },
  { code: 'ta-IN', label: 'தமிழ்' },
  { code: 'te-IN', label: 'తెలుగు' },
  { code: 'mr-IN', label: 'मराठी' },
  { code: 'kn-IN', label: 'ಕನ್ನಡ' },
  { code: 'ml-IN', label: 'മലയാളം' },
  { code: 'gu-IN', label: 'ગુજરાતી' },
  { code: 'pa-IN', label: 'ਪੰਜਾਬੀ' },
  { code: 'ur-IN', label: 'اردو' },
  { code: 'or-IN', label: 'ଓଡ଼ିଆ' },
]

export default function AiAssistantPage() {
  const router = useRouter()
  const { currentUser, isSubAgent, parentAgentId, loading: authLoading } = useAuth()

  const [packages, setPackages] = useState<AgentPackage[]>([])
  const [loadingPkgs, setLoadingPkgs] = useState(true)

  // AI state
  const [aiMessages, setAiMessages] = useState<{ role: 'user' | 'assistant'; content: string; ts: number }[]>([])
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [selectedAiPkg, setSelectedAiPkg] = useState<AgentPackage | null>(null)
  const [aiLang, setAiLang] = useState('hi-IN')
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [pkgPickerOpen, setPkgPickerOpen] = useState(false)
  const [pkgPickerSearch, setPkgPickerSearch] = useState('')
  const [autoSpeak, setAutoSpeak] = useState(true)
  const [continuousMode, setContinuousMode] = useState(false)
  const [continuousStatus, setContinuousStatus] = useState<'listening' | 'thinking' | 'speaking' | 'idle'>('idle')

  const recognitionRef = useRef<any>(null)
  const aiChatEndRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const continuousModeRef = useRef(false)
  const aiLangRef = useRef('hi-IN')
  const selectedAiPkgRef = useRef<AgentPackage | null>(null)
  const aiMessagesRef = useRef<{ role: 'user' | 'assistant'; content: string; ts: number }[]>([])

  // Auth redirect
  useEffect(() => {
    if (!authLoading) {
      if (!currentUser) router.push('/agent-login')
      else if (!isSubAgent) router.push('/')
    }
  }, [authLoading, currentUser, isSubAgent, router])

  // Fetch packages
  const fetchPackages = useCallback(async () => {
    if (!parentAgentId) return
    setLoadingPkgs(true)
    try {
      const res = await fetch(`/api/agent/packages?agentId=${parentAgentId}`)
      const data = await res.json()
      if (data.success) {
        setPackages(data.packages.filter((p: any) => p.isActive)
          .sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)))
      }
    } catch { } finally { setLoadingPkgs(false) }
  }, [parentAgentId])

  useEffect(() => {
    if (!authLoading && currentUser && isSubAgent) fetchPackages()
  }, [authLoading, currentUser, isSubAgent, fetchPackages])

  // Scroll to bottom on new messages
  useEffect(() => {
    aiChatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [aiMessages, aiLoading])

  // Keep refs in sync
  useEffect(() => { aiLangRef.current = aiLang }, [aiLang])
  useEffect(() => { selectedAiPkgRef.current = selectedAiPkg }, [selectedAiPkg])
  useEffect(() => { aiMessagesRef.current = aiMessages }, [aiMessages])

  function stopSpeaking() {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setIsSpeaking(false)
  }

  async function speakText(text: string, onEnd?: () => void) {
    stopSpeaking()
    setIsSpeaking(true)
    const done = () => { setIsSpeaking(false); onEnd?.() }
    try {
      const res = await fetch('/api/ai-planner/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error('TTS API failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => { URL.revokeObjectURL(url); done() }
      audio.onerror = () => { URL.revokeObjectURL(url); done() }
      await audio.play()
    } catch {
      if ('speechSynthesis' in window) {
        const utt = new SpeechSynthesisUtterance(text)
        utt.lang = aiLangRef.current
        utt.onend = done
        utt.onerror = done
        window.speechSynthesis.speak(utt)
      } else {
        done()
      }
    }
  }

  async function sendAiMessage(text?: string, restartAfter = false) {
    const msg = (text ?? aiInput).trim()
    if (!msg) return
    const userMsg = { role: 'user' as const, content: msg, ts: Date.now() }
    const updated = [...aiMessagesRef.current, userMsg]
    setAiMessages(updated)
    setAiInput('')
    setAiLoading(true)
    if (continuousModeRef.current) setContinuousStatus('thinking')
    try {
      const res = await fetch('/api/agent/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          language: aiLangRef.current,
          packageDetails: selectedAiPkgRef.current,
          conversation: updated.slice(-20),
        }),
      })
      const data = await res.json()
      const reply = data.reply || 'Sorry, something went wrong.'
      setAiMessages(prev => [...prev, { role: 'assistant' as const, content: reply, ts: Date.now() }])
      if (autoSpeak || restartAfter) {
        if (continuousModeRef.current) setContinuousStatus('speaking')
        speakText(reply, () => {
          if (continuousModeRef.current) startContinuousListening()
        })
      } else if (continuousModeRef.current) {
        startContinuousListening()
      }
    } catch {
      setAiMessages(prev => [...prev, { role: 'assistant' as const, content: 'Error getting response. Please try again.', ts: Date.now() }])
      if (continuousModeRef.current) startContinuousListening()
    } finally {
      setAiLoading(false)
    }
  }

  function toggleVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('Voice input is not supported in this browser. Please use Chrome.'); return }
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return }
    const recog = new SR()
    recog.lang = aiLangRef.current
    recog.continuous = false
    recog.interimResults = false
    recog.onresult = (e: any) => {
      const t = e.results[0]?.[0]?.transcript || ''
      if (t) sendAiMessage(t)
    }
    recog.onerror = () => setIsListening(false)
    recog.onend = () => setIsListening(false)
    recognitionRef.current = recog
    recog.start()
    setIsListening(true)
  }

  function startContinuousListening() {
    if (!continuousModeRef.current) return
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    setContinuousStatus('listening')
    let gotResult = false
    const recog = new SR()
    recog.lang = aiLangRef.current
    recog.continuous = false
    recog.interimResults = false
    recog.onresult = (e: any) => {
      gotResult = true
      const t = e.results[0]?.[0]?.transcript?.trim() || ''
      const stopWords = ['stop', 'रुको', 'बंद करो', 'நிறுத்து', 'ఆపు', 'ನಿಲ್ಲಿಸು', 'നിർത്തൂ', 'বন্ধ করো', 'ਰੁਕੋ', 'બంધ કરો']
      if (stopWords.some(w => t.toLowerCase().includes(w.toLowerCase()))) {
        stopContinuousConversation()
        return
      }
      if (t) sendAiMessage(t, true)
    }
    recog.onerror = () => {
      setIsListening(false)
      if (continuousModeRef.current) setTimeout(() => startContinuousListening(), 800)
    }
    recog.onend = () => {
      setIsListening(false)
      if (!gotResult && continuousModeRef.current) setTimeout(() => startContinuousListening(), 400)
    }
    recognitionRef.current = recog
    recog.start()
    setIsListening(true)
  }

  function startContinuousConversation() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('Voice conversation requires Chrome or Edge browser.'); return }
    continuousModeRef.current = true
    setContinuousMode(true)
    stopSpeaking()
    startContinuousListening()
  }

  function stopContinuousConversation() {
    continuousModeRef.current = false
    setContinuousMode(false)
    setContinuousStatus('idle')
    recognitionRef.current?.stop()
    stopSpeaking()
    setIsListening(false)
  }

  if (authLoading || loadingPkgs) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.push('/travel-agent-dashboard')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Dashboard
        </button>
        <div className="w-px h-4 bg-gray-200" />
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bot className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold text-gray-900">AI Package Assistant</span>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">DEV</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col gap-4 p-4 max-w-4xl mx-auto w-full" style={{ height: 'calc(100vh - 57px)' }}>
        {/* Controls row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Package picker trigger */}
          <button
            onClick={() => { setPkgPickerSearch(''); setPkgPickerOpen(true) }}
            className={`flex-1 min-w-[220px] flex items-center gap-3 px-3 py-2 rounded-xl border text-sm transition-colors text-left ${
              selectedAiPkg
                ? 'border-primary/30 bg-primary/5'
                : 'border-gray-200 bg-white hover:border-primary/30 hover:bg-gray-50'
            }`}
          >
            {selectedAiPkg ? (
              <>
                {selectedAiPkg.primaryImageUrl ? (
                  <img src={selectedAiPkg.primaryImageUrl} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-xs truncate">{selectedAiPkg.title}</p>
                  <p className="text-[11px] text-gray-400 truncate">{selectedAiPkg.destination} · {selectedAiPkg.durationNights}N {selectedAiPkg.durationDays}D</p>
                </div>
                <span className="text-xs font-bold text-primary flex-shrink-0">₹{(selectedAiPkg.pricePerPerson/1000).toFixed(0)}K</span>
                <button
                  onClick={e => { e.stopPropagation(); setSelectedAiPkg(null) }}
                  className="text-gray-300 hover:text-red-400 flex-shrink-0 transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Package className="w-4 h-4 text-gray-400" />
                </div>
                <span className="text-gray-400 flex-1">Choose a package…</span>
                <ChevronDown className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </>
            )}
          </button>

          {/* Language selector */}
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={aiLang}
              onChange={e => setAiLang(e.target.value)}
              className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white appearance-none"
            >
              {INDIAN_LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>

          {/* Voice conversation toggle */}
          <button
            onClick={continuousMode ? stopContinuousConversation : startContinuousConversation}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all flex-shrink-0 ${
              continuousMode
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-gradient-to-r from-primary to-primary/80 text-white hover:opacity-90 shadow-sm shadow-primary/30'
            }`}
          >
            {continuousMode
              ? <><MicOff className="w-4 h-4" /> End Chat</>
              : <><Mic className="w-4 h-4" /> Voice Chat</>
            }
          </button>

          {/* Clear chat */}
          {aiMessages.length > 0 && (
            <button
              onClick={() => { setAiMessages([]); stopSpeaking() }}
              className="text-xs text-gray-400 hover:text-red-500 font-medium px-3 py-2 rounded-xl border border-gray-200 hover:border-red-200 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Package picker modal */}
        {pkgPickerOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/40 z-50"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setPkgPickerOpen(false)}
            />
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            >
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <div>
                    <h3 className="font-bold text-gray-900">Choose a Package</h3>
                    <p className="text-xs text-gray-400 mt-0.5">AI will answer questions about the selected package</p>
                  </div>
                  <button onClick={() => setPkgPickerOpen(false)} className="text-gray-400 hover:text-gray-700 p-1">
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
                <div className="px-5 pt-3 pb-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      autoFocus
                      value={pkgPickerSearch}
                      onChange={e => setPkgPickerSearch(e.target.value)}
                      placeholder="Search packages or destinations…"
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-5 pb-5">
                  {packages.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 text-sm">No packages available</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                      {packages
                        .filter(p => !pkgPickerSearch || p.title.toLowerCase().includes(pkgPickerSearch.toLowerCase()) || p.destination.toLowerCase().includes(pkgPickerSearch.toLowerCase()))
                        .map(p => (
                          <button
                            key={p.id}
                            onClick={() => { setSelectedAiPkg(p); setPkgPickerOpen(false) }}
                            className={`text-left rounded-2xl border overflow-hidden transition-all hover:shadow-md group ${
                              selectedAiPkg?.id === p.id
                                ? 'border-primary ring-2 ring-primary/20'
                                : 'border-gray-200 hover:border-primary/40'
                            }`}
                          >
                            <div className="relative h-32 w-full bg-gray-100 overflow-hidden">
                              {p.primaryImageUrl ? (
                                <img src={p.primaryImageUrl} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Package className="w-8 h-8 text-gray-300" />
                                </div>
                              )}
                              <span className="absolute top-2 left-2 bg-black/50 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm">
                                {p.durationNights}N {p.durationDays}D
                              </span>
                              {selectedAiPkg?.id === p.id && (
                                <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                                  <Check className="w-3 h-3 text-white" />
                                </div>
                              )}
                            </div>
                            <div className="p-3">
                              <p className="font-bold text-gray-900 text-sm leading-snug truncate">{p.title}</p>
                              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{p.destination}</span>
                                <span className="flex items-center gap-0.5 ml-auto text-amber-500 font-semibold">
                                  <Star className="w-3 h-3 fill-amber-400" />{p.starCategory}
                                </span>
                              </div>
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{p.travelType}</span>
                                <span className="font-bold text-primary text-sm">₹{p.pricePerPerson.toLocaleString('en-IN')}<span className="text-[10px] font-normal text-gray-400">/person</span></span>
                              </div>
                            </div>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}

        {/* Chat area */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {aiMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8 px-4">
                {!selectedAiPkg ? (
                  <div className="w-full max-w-lg">
                    <div className="text-center mb-6">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-primary/20">
                        <Bot className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="font-bold text-gray-900 text-base">AI Travel Assistant</h3>
                      <p className="text-sm text-gray-400 mt-1">Pick a package below to start asking questions in any Indian language</p>
                    </div>
                    <div className="space-y-2">
                      {packages.slice(0, 4).map(p => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedAiPkg(p)}
                          className="w-full flex items-center gap-3 p-3 bg-white border border-gray-200 hover:border-primary/40 hover:bg-primary/5 rounded-2xl transition-all group text-left"
                        >
                          {p.primaryImageUrl ? (
                            <img src={p.primaryImageUrl} alt={p.title} className="w-12 h-12 rounded-xl object-cover flex-shrink-0 group-hover:scale-105 transition-transform" />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                              <Package className="w-5 h-5 text-gray-300" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 text-sm truncate">{p.title}</p>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3" />{p.destination}
                              <span className="mx-1 text-gray-300">·</span>
                              <Clock className="w-3 h-3" />{p.durationNights}N {p.durationDays}D
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-primary">₹{(p.pricePerPerson/1000).toFixed(0)}K</p>
                            <p className="text-[10px] text-gray-400">/person</p>
                          </div>
                          <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-primary flex-shrink-0 transition-colors" />
                        </button>
                      ))}
                    </div>
                    {packages.length > 4 && (
                      <button
                        onClick={() => { setPkgPickerSearch(''); setPkgPickerOpen(true) }}
                        className="w-full mt-3 py-2.5 text-sm font-semibold text-primary bg-primary/5 hover:bg-primary/10 rounded-xl transition-colors border border-primary/20"
                      >
                        Browse all {packages.length} packages →
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="w-full max-w-lg">
                    <div className="rounded-2xl border border-gray-200 overflow-hidden mb-5 shadow-sm">
                      {selectedAiPkg.primaryImageUrl ? (
                        <div className="relative h-36">
                          <img src={selectedAiPkg.primaryImageUrl} alt={selectedAiPkg.title} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                          <div className="absolute bottom-3 left-3 right-3">
                            <p className="font-bold text-white text-sm leading-snug">{selectedAiPkg.title}</p>
                            <p className="text-white/80 text-xs flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3" />{selectedAiPkg.destination}
                              <span className="mx-1 opacity-50">·</span>
                              {selectedAiPkg.durationNights}N {selectedAiPkg.durationDays}D
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gradient-to-br from-primary/20 to-primary/5 px-4 py-5">
                          <p className="font-bold text-gray-900 text-sm">{selectedAiPkg.title}</p>
                          <p className="text-gray-500 text-xs mt-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />{selectedAiPkg.destination} · {selectedAiPkg.durationNights}N {selectedAiPkg.durationDays}D
                          </p>
                        </div>
                      )}
                      <div className="px-4 py-3 flex items-center gap-4 bg-white">
                        <div className="flex-1">
                          <p className="text-xl font-bold text-primary">₹{selectedAiPkg.pricePerPerson.toLocaleString('en-IN')}</p>
                          <p className="text-[11px] text-gray-400">per person</p>
                        </div>
                        <div className="flex gap-2 text-xs">
                          <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{selectedAiPkg.travelType}</span>
                          <span className="bg-amber-50 text-amber-600 px-2.5 py-1 rounded-full flex items-center gap-0.5">
                            <Star className="w-3 h-3 fill-amber-400" />{selectedAiPkg.starCategory}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Ask me anything</p>
                      <button
                        onClick={startContinuousConversation}
                        className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-gradient-to-r from-primary to-primary/80 text-white rounded-xl shadow-sm shadow-primary/30 hover:opacity-90"
                      >
                        <Mic className="w-3.5 h-3.5" /> Start Voice Chat
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { emoji: '✨', text: 'इस पैकेज की खास बात क्या है?', sub: 'Highlights' },
                        { emoji: '💼', text: 'इसे customer को कैसे बेचें?', sub: 'Sales pitch' },
                        { emoji: '📋', text: 'What is included in this package?', sub: 'Inclusions' },
                        { emoji: '🗣️', text: 'இந்த package பற்றி சொல்லுங்கள்', sub: 'Tamil' },
                      ].map(q => (
                        <button
                          key={q.text}
                          onClick={() => sendAiMessage(q.text)}
                          className="flex items-start gap-2 p-3 bg-gray-50 hover:bg-primary/5 border border-gray-200 hover:border-primary/30 rounded-xl text-left transition-all group"
                        >
                          <span className="text-base flex-shrink-0">{q.emoji}</span>
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold text-gray-500 group-hover:text-primary mb-0.5">{q.sub}</p>
                            <p className="text-xs text-gray-400 leading-snug line-clamp-2">{q.text}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                {aiMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                        <Bot className="w-3.5 h-3.5 text-primary" />
                      </div>
                    )}
                    <div className={`max-w-xs lg:max-w-md rounded-2xl px-4 py-2.5 ${
                      msg.role === 'user'
                        ? 'bg-primary text-white rounded-br-sm'
                        : 'bg-gray-50 border border-gray-200 text-gray-900 rounded-bl-sm'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    </div>
                    {msg.role === 'assistant' && (
                      <button
                        onClick={() => speakText(msg.content)}
                        className="ml-2 mt-1 text-gray-300 hover:text-primary flex-shrink-0 self-start transition-colors"
                        title="Listen to this message"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {aiLoading && (
                  <div className="flex justify-start">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                      <Bot className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3">
                      <div className="flex gap-1 items-center">
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={aiChatEndRef} />
              </>
            )}
          </div>

          {/* Continuous conversation bar */}
          {continuousMode && (
            <div className="border-t border-gray-100 px-4 py-3 flex items-center gap-3 bg-gradient-to-r from-primary/5 to-primary/10">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  continuousStatus === 'listening' ? 'bg-red-500 animate-pulse' :
                  continuousStatus === 'thinking' ? 'bg-amber-400 animate-pulse' :
                  continuousStatus === 'speaking' ? 'bg-primary animate-pulse' : 'bg-gray-300'
                }`}>
                  {continuousStatus === 'listening' && <Mic className="w-4 h-4 text-white" />}
                  {continuousStatus === 'thinking' && <Loader2 className="w-4 h-4 text-white animate-spin" />}
                  {continuousStatus === 'speaking' && <Volume2 className="w-4 h-4 text-white" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-800">
                    {continuousStatus === 'listening' && 'Listening…'}
                    {continuousStatus === 'thinking' && 'Thinking…'}
                    {continuousStatus === 'speaking' && 'Speaking…'}
                  </p>
                  <p className="text-[11px] text-gray-400 truncate">
                    {continuousStatus === 'listening' && `Say anything in ${INDIAN_LANGUAGES.find(l => l.code === aiLang)?.label || 'Hindi'} · say "stop" to end`}
                    {continuousStatus === 'thinking' && 'Getting your answer…'}
                    {continuousStatus === 'speaking' && 'Will listen again when done speaking'}
                  </p>
                </div>
              </div>
              {continuousStatus === 'listening' && (
                <div className="flex items-end gap-0.5 h-5 flex-shrink-0">
                  {[8, 14, 10, 16, 8, 12, 6].map((h, i) => (
                    <span key={i} className="w-1 bg-red-400 rounded-full animate-bounce"
                      style={{ height: `${h}px`, animationDelay: `${i * 80}ms` }} />
                  ))}
                </div>
              )}
              <button
                onClick={stopContinuousConversation}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-xl flex-shrink-0 transition-colors"
              >
                <MicOff className="w-3.5 h-3.5" /> End
              </button>
            </div>
          )}

          {/* Input row */}
          <div className={`border-t border-gray-100 px-4 py-3 flex items-end gap-2 ${continuousMode ? 'opacity-40 pointer-events-none' : ''}`}>
            <textarea
              value={aiInput}
              onChange={e => setAiInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAiMessage() } }}
              rows={2}
              placeholder={`Ask anything… (${INDIAN_LANGUAGES.find(l => l.code === aiLang)?.label || 'Hindi'})`}
              className="flex-1 resize-none px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
              disabled={aiLoading}
            />
            <button
              onClick={toggleVoice}
              title={isListening ? 'Stop listening' : 'Speak in ' + (INDIAN_LANGUAGES.find(l => l.code === aiLang)?.label || 'Hindi')}
              className={`p-2.5 rounded-xl flex-shrink-0 transition-colors ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-gray-100 text-gray-500 hover:bg-primary/10 hover:text-primary'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            {isSpeaking ? (
              <button
                onClick={stopSpeaking}
                title="Speaking — tap to stop"
                className="p-2.5 rounded-xl flex-shrink-0 bg-amber-400 text-white animate-pulse"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setAutoSpeak(v => !v)}
                title={autoSpeak ? 'Auto-speak ON — click to mute' : 'Auto-speak OFF — click to enable'}
                className={`p-2.5 rounded-xl flex-shrink-0 transition-colors ${
                  autoSpeak
                    ? 'bg-primary/10 text-primary hover:bg-primary/20'
                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                }`}
              >
                <Volume2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => sendAiMessage()}
              disabled={!aiInput.trim() || aiLoading}
              className="p-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-50 flex-shrink-0"
            >
              {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
