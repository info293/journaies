'use client'

import { useState, useRef, useEffect } from 'react'
import indianDestinationsData from '@/data/indian-destinations-data.json'

const OPTIONS_EXPERIENCE = [
    { id: 'adventure', label: 'Adventure', icon: '🏂' },
    { id: 'wellness', label: 'Wellness', icon: '🧘‍♀️' },
    { id: 'party', label: 'Party', icon: '🎉' },
    { id: 'culture', label: 'Culture', icon: '🏛️' },
    { id: 'romance', label: 'Romance', icon: '❤️' },
    { id: 'food_wine', label: 'Food & Wine', icon: '🍷' },
    { id: 'instagram', label: 'Instagram', icon: '📸' },
    { id: 'relax', label: 'Relax', icon: '🏖️' }
]

const HOTEL_STAR_OPTIONS = [
    { id: '3-star', label: '3-Star', desc: 'Comfortable & Budget-Friendly', icon: '⭐⭐⭐' },
    { id: '4-star', label: '4-Star', desc: 'Premium Amenities', icon: '⭐⭐⭐⭐' },
    { id: '5-star', label: '5-Star', desc: 'Ultimate Luxury', icon: '⭐⭐⭐⭐⭐' },
]

interface DestinationOption {
    name: string   // what gets saved to wizard data (e.g. "Kerala")
    label: string  // what the user sees in dropdown (e.g. "Kerala, India")
}

// Fallback destinations from local JSON
const FALLBACK_DESTINATIONS: DestinationOption[] = Array.from(
    new Map(
        indianDestinationsData.destinations.map(
            (d: { name: string; country: string }) => [d.name, { name: d.name, label: `${d.name}, ${d.country}` }]
        )
    ).values()
)

export default function Step1Destinations({
    data,
    updateData,
    onNext,
    agentSlug,
}: {
    data: any,
    updateData: (data: any) => void,
    onNext: () => void,
    agentSlug?: string,
}) {
    const isDmcMode = !!agentSlug

    const [currentDestination, setCurrentDestination] = useState('')
    const [showDropdown, setShowDropdown] = useState(false)
    const [highlightedIndex, setHighlightedIndex] = useState(-1)
    const [allDestinations, setAllDestinations] = useState<DestinationOption[]>(agentSlug ? [] : FALLBACK_DESTINATIONS)
    const [isLoading, setIsLoading] = useState(true)
    const inputRef = useRef<HTMLInputElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Fetch destinations on mount — from agent_packages when on an agent page, else from main destinations
    useEffect(() => {
        async function fetchDestinations() {
            try {
                const { db } = await import('@/lib/firebase')
                const { collection, getDocs, query, where } = await import('firebase/firestore')

                if (!db) { setIsLoading(false); return }

                if (agentSlug) {
                    // AGENT MODE: only show destinations this agent has active packages for
                    const q = query(
                        collection(db, 'agent_packages'),
                        where('agentSlug', '==', agentSlug),
                        where('isActive', '==', true)
                    )
                    const snap = await getDocs(q)
                    const seen = new Set<string>()
                    const options: DestinationOption[] = []

                    snap.forEach(doc => {
                        const d = doc.data()
                        const name = d.destination as string
                        if (name && !seen.has(name)) {
                            seen.add(name)
                            options.push({
                                name,
                                label: d.destinationCountry ? `${name}, ${d.destinationCountry}` : name,
                            })
                        }
                    })

                    setAllDestinations(options)
                } else {
                    // MAIN SITE MODE: fetch from destinations collection
                    const snapshot = await getDocs(collection(db, 'destinations'))
                    const options: DestinationOption[] = []
                    const seen = new Set<string>()

                    snapshot.forEach(doc => {
                        const d = doc.data()
                        if (d.name && !seen.has(d.name)) {
                            seen.add(d.name)
                            options.push({
                                name: d.name,
                                label: d.country ? `${d.name}, ${d.country}` : d.name,
                            })
                        }
                    })

                    if (options.length > 0) setAllDestinations(options)
                }
            } catch (err) {
                console.error('Failed to fetch destinations:', err)
            } finally {
                setIsLoading(false)
            }
        }

        fetchDestinations()
    }, [agentSlug])

    const filteredDestinations = currentDestination.trim().length > 0
        ? allDestinations.filter(d =>
            d.label.toLowerCase().includes(currentDestination.toLowerCase()) ||
            d.name.toLowerCase().includes(currentDestination.toLowerCase())
        )
        : allDestinations

    const isValidDestination = (value: string) =>
        allDestinations.some(d =>
            d.label.toLowerCase() === value.toLowerCase() ||
            d.name.toLowerCase() === value.toLowerCase()
        )

    const handleAddDestination = (dest?: DestinationOption | string) => {
        let option: DestinationOption | undefined
        if (dest && typeof dest === 'object') {
            option = dest
        } else {
            const value = (typeof dest === 'string' ? dest : currentDestination).trim()
            option = allDestinations.find(d =>
                d.label.toLowerCase() === value.toLowerCase() ||
                d.name.toLowerCase() === value.toLowerCase()
            )
        }
        if (option && data.destinations.length === 0) {
            // Save only the name (e.g. "Kerala"), not "Kerala, India"
            updateData({ destinations: [option.name] })
            setCurrentDestination('')
            setShowDropdown(false)
            setHighlightedIndex(-1)
        }
    }

    const handleRemoveDestination = (index: number) => {
        const newDestinations = [...data.destinations]
        newDestinations.splice(index, 1)
        updateData({ destinations: newDestinations })
    }

    const toggleExperience = (id: string) => {
        const current = new Set(data.experiences)
        if (current.has(id)) {
            current.delete(id)
        } else {
            current.add(id)
        }
        updateData({ experiences: Array.from(current) })
    }

    const toggleHotelStar = (id: string) => {
        const current = new Set(data.hotelTypes as string[])
        if (current.has(id)) {
            current.delete(id)
        } else {
            current.add(id)
        }
        updateData({ hotelTypes: Array.from(current) })
    }

    const setHotelIncluded = (value: boolean) => {
        updateData({
            hotelIncluded: value,
            hotelTypes: value ? (data.hotelTypes.length > 0 ? data.hotelTypes : ['4-star']) : [],
        })
    }

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
                inputRef.current && !inputRef.current.contains(e.target as Node)
            ) {
                setShowDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHighlightedIndex(prev => Math.min(prev + 1, filteredDestinations.length - 1))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlightedIndex(prev => Math.max(prev - 1, 0))
        } else if (e.key === 'Enter') {
            e.preventDefault()
            if (highlightedIndex >= 0 && filteredDestinations[highlightedIndex]) {
                handleAddDestination(filteredDestinations[highlightedIndex])
            } else {
                handleAddDestination()
            }
        } else if (e.key === 'Escape') {
            setShowDropdown(false)
        }
    }

    return (
        <div className="animate-fade-in-up">
            <div className="text-center mb-8">
                <h2 className="text-3xl sm:text-5xl font-bold text-gray-900 mb-3 tracking-tight">
                    Where would you like to go?
                </h2>
                <p className="text-sm sm:text-lg text-gray-500 font-medium px-2">
                    Tell us your dream destinations and when you want to travel.
                </p>
            </div>

            <div className="max-w-2xl mx-auto space-y-3">

                {/* ── Section 1: Destination ── */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-visible">
                    <div className="px-5 pt-5 pb-5">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] flex items-center gap-2 mb-4">
                            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-black flex-shrink-0">1</span>
                            Destination
                        </p>

                        {/* Selected destination chip */}
                        {data.destinations.map((dest: string, idx: number) => (
                            <div
                                key={idx}
                                className="inline-flex items-center gap-2.5 bg-gradient-to-r from-primary to-[#ff8a3d] text-white pl-4 pr-3 py-2.5 rounded-2xl font-bold shadow-lg shadow-primary/25 text-sm mb-4"
                            >
                                <svg className="w-4 h-4 opacity-80 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span>{dest}</span>
                                <button
                                    onClick={() => handleRemoveDestination(idx)}
                                    className="w-5 h-5 bg-white/20 rounded-full hover:bg-white/40 flex items-center justify-center transition-colors flex-shrink-0"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        ))}

                        {/* Search input */}
                        {data.destinations.length === 0 && (
                            <div className="relative">
                                <div className="relative flex items-center group">
                                    <div className="absolute left-4 text-gray-400 group-focus-within:text-primary transition-colors">
                                        {isLoading ? (
                                            <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                        ) : (
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                        )}
                                    </div>
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={currentDestination}
                                        onChange={(e) => { setCurrentDestination(e.target.value); setShowDropdown(true); setHighlightedIndex(-1) }}
                                        onFocus={() => setShowDropdown(true)}
                                        onKeyDown={handleKeyDown}
                                        placeholder={isLoading ? 'Loading destinations…' : 'Search destinations…'}
                                        disabled={isLoading}
                                        autoComplete="off"
                                        className="w-full pl-12 pr-24 py-3.5 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:bg-white focus:border-primary/30 focus:ring-4 focus:ring-primary/8 transition-all text-base font-medium outline-none text-gray-900 placeholder-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                    <button
                                        onClick={() => handleAddDestination()}
                                        disabled={!currentDestination.trim() || !isValidDestination(currentDestination)}
                                        className="absolute right-2 px-4 py-2 bg-gray-900 text-white rounded-xl font-bold disabled:opacity-0 disabled:pointer-events-none hover:bg-gray-700 transition-all text-sm"
                                    >
                                        Add
                                    </button>
                                </div>

                                {currentDestination.trim().length > 0 && !isValidDestination(currentDestination) && filteredDestinations.length === 0 && (
                                    <p className="mt-2 text-xs text-amber-500 font-medium pl-1">
                                        {agentSlug ? '⚠️ Not available in this agent\'s packages.' : '⚠️ No packages found for this destination yet.'}
                                    </p>
                                )}

                                {agentSlug && !isLoading && allDestinations.length === 0 && (
                                    <p className="mt-3 text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-xl">
                                        No packages available yet. Please contact the agent directly.
                                    </p>
                                )}

                                {showDropdown && !isLoading && filteredDestinations.length > 0 && (
                                    <div ref={dropdownRef} className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl overflow-hidden">
                                        <ul className="max-h-52 overflow-y-auto py-1.5">
                                            {filteredDestinations.map((dest, idx) => (
                                                <li
                                                    key={dest.name}
                                                    onMouseDown={(e) => { e.preventDefault(); handleAddDestination(dest) }}
                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer text-sm font-medium transition-colors ${
                                                        highlightedIndex === idx ? 'bg-primary/8 text-primary' : 'text-gray-700 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                                                        <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        </svg>
                                                    </span>
                                                    {dest.label}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Section 2: Travel Date ── */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-5">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] flex items-center gap-2 mb-4">
                            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-black flex-shrink-0">2</span>
                            When are you traveling?
                        </p>
                        <div className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <input
                                type="date"
                                min={new Date().toISOString().split('T')[0]}
                                value={(!['Flexible', 'Next Month', 'Within 3 Months', 'Decided Dates'].includes(data.dateRange) && data.dateRange) ? data.dateRange : ''}
                                onChange={(e) => updateData({ dateRange: e.target.value })}
                                onClick={(e) => { try { (e.target as HTMLInputElement).showPicker?.() } catch {} }}
                                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:bg-white focus:border-primary/30 focus:ring-4 focus:ring-primary/8 transition-all font-semibold text-gray-900 outline-none cursor-pointer"
                            />
                        </div>
                    </div>
                </div>

                {/* ── Section 3: Hotel Preference (DMC only) ── */}
                {isDmcMode && (
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-5">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] flex items-center gap-2 mb-4">
                                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-black flex-shrink-0">3</span>
                                Hotel Preference
                            </p>

                            {/* Segmented control */}
                            <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-gray-100 rounded-2xl mb-4">
                                <button
                                    onClick={() => setHotelIncluded(false)}
                                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-200 ${
                                        !data.hotelIncluded
                                            ? 'bg-white shadow-sm text-gray-900 scale-[1.01]'
                                            : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    <span className="text-lg">🏕️</span>
                                    Without Hotel
                                </button>
                                <button
                                    onClick={() => setHotelIncluded(true)}
                                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-200 ${
                                        data.hotelIncluded
                                            ? 'bg-gray-900 shadow-md text-white scale-[1.01]'
                                            : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    <span className="text-lg">🏨</span>
                                    With Hotel
                                </button>
                            </div>

                            {/* Star category tiles */}
                            {data.hotelIncluded && (
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.12em] mb-3">Select Star Category</p>
                                    <div className="grid grid-cols-3 gap-3">
                                        {HOTEL_STAR_OPTIONS.map((opt) => {
                                            const isSelected = (data.hotelTypes as string[]).includes(opt.id)
                                            const starCount = opt.id === '3-star' ? 3 : opt.id === '4-star' ? 4 : 5
                                            return (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => toggleHotelStar(opt.id)}
                                                    className={`relative flex flex-col items-center justify-center gap-2 py-5 px-3 rounded-2xl border-2 transition-all duration-200 select-none ${
                                                        isSelected
                                                            ? 'bg-gradient-to-br from-primary/10 to-[#ff8a3d]/10 border-primary shadow-lg shadow-primary/15 scale-[1.04]'
                                                            : 'bg-gray-50 border-gray-100 hover:border-primary/30 hover:bg-primary/5 hover:scale-[1.02]'
                                                    }`}
                                                >
                                                    {isSelected && (
                                                        <span className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-sm">
                                                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        </span>
                                                    )}
                                                    <div className="flex gap-0.5">
                                                        {Array.from({ length: starCount }).map((_, i) => (
                                                            <svg key={i} className={`w-4 h-4 transition-colors ${isSelected ? 'text-amber-400' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 20 20">
                                                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                            </svg>
                                                        ))}
                                                    </div>
                                                    <span className={`text-sm font-black tracking-tight ${isSelected ? 'text-gray-900' : 'text-gray-500'}`}>{opt.label}</span>
                                                    <span className={`text-[10px] font-semibold text-center leading-tight ${isSelected ? 'text-primary' : 'text-gray-400'}`}>{opt.desc}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Section 3 (main site): Vibe / Experiences ── */}
                {!isDmcMode && (
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-5">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] flex items-center gap-2 mb-4">
                                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-black flex-shrink-0">3</span>
                                Choose your vibe
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {OPTIONS_EXPERIENCE.map((exp) => {
                                    const isSelected = data.experiences.includes(exp.id)
                                    return (
                                        <button
                                            key={exp.id}
                                            onClick={() => toggleExperience(exp.id)}
                                            className={`flex items-center gap-2 px-4 py-2.5 rounded-full border-2 text-sm font-semibold transition-all duration-200 select-none ${
                                                isSelected
                                                    ? 'bg-gray-900 border-gray-900 text-white shadow-md scale-[1.03]'
                                                    : 'bg-gray-50 border-gray-100 text-gray-600 hover:border-gray-200 hover:bg-gray-100'
                                            }`}
                                        >
                                            <span className={`text-base ${isSelected ? '' : 'grayscale opacity-60'}`}>{exp.icon}</span>
                                            {exp.label}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}

            </div>

            <div className="mt-8 flex justify-center">
                <button
                    onClick={onNext}
                    disabled={data.destinations.length === 0}
                    className="px-10 py-3.5 bg-gray-900 text-white rounded-full font-bold text-base shadow-xl hover:shadow-2xl hover:bg-gray-800 hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
                >
                    {isDmcMode ? 'Next →' : 'Customize Route →'}
                </button>
            </div>

        </div>
    )
}
