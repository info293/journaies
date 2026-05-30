'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'

export default function Step2Nights({
    data,
    updateData,
    onNext,
    onPrev,
    agentSlug,
    isSubmitting,
}: {
    data: any,
    updateData: (data: any) => void,
    onNext: () => void,
    onPrev: () => void,
    agentSlug?: string,
    isSubmitting?: boolean,
}) {
    const isDmcMode = !!agentSlug

    const [availableOptions, setAvailableOptions] = useState<Record<string, { nights: number, label: string }[]>>({})
    const [loading, setLoading] = useState(true)

    // Create a synchronized route planning state based on destinations
    const routeItems = data.destinations.map((d: string, index: number) => {
        const existingItem = data.routeItems.find((item: any) => item.destination === d);
        return existingItem || {
            id: `route-${index}`,
            destination: d,
            nights: null
        };
    });

    // Save synchronized route elements back to state if they change
    useEffect(() => {
        const isSyncNeeded = data.destinations.length !== data.routeItems.length ||
            data.destinations.some((d: string, i: number) => data.routeItems[i]?.destination !== d);

        if (isSyncNeeded) {
            updateData({ routeItems });
        }
    }, [data.destinations, data.routeItems, routeItems, updateData]);

    useEffect(() => {
        const fetchPackageNights = async () => {
            if (!db) {
                setLoading(false)
                return
            }

            try {
                setLoading(true)

                const destPackagesOptions: Record<string, { nights: number, label: string }[]> = {}
                const matchingPackagesByDest: Record<string, any[]> = {}

                data.destinations.forEach((dest: string) => {
                    destPackagesOptions[dest] = []
                    matchingPackagesByDest[dest] = []
                })

                const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop&auto=format'

                if (agentSlug) {
                    // AGENT MODE: fetch durations from agent_packages
                    const agentPkgQ = query(
                        collection(db, 'agent_packages'),
                        where('agentSlug', '==', agentSlug),
                        where('isActive', '==', true)
                    )
                    const agentPkgSnap = await getDocs(agentPkgQ)

                    agentPkgSnap.forEach((doc) => {
                        const docData = doc.data()
                        const pkgDest = (docData.destination || '').trim().toLowerCase()

                        data.destinations.forEach((dest: string) => {
                            const normalizedDest = dest.trim().toLowerCase()
                            if (!normalizedDest) return

                            const hasMatch = pkgDest && (pkgDest.includes(normalizedDest) || normalizedDest.includes(pkgDest))
                            if (!hasMatch) return

                            const image = docData.primaryImageUrl || FALLBACK_IMAGE
                            matchingPackagesByDest[dest].push({
                                id: doc.id,
                                name: docData.destination || dest,
                                packageTitle: docData.title || docData.destination || dest,
                                location: docData.destination || dest,
                                image,
                                dest,
                                starCategory: docData.starCategory || '',
                                duration: docData.durationDays ? `${docData.durationDays}D/${docData.durationNights}N` : '',
                            })

                            const nights = typeof docData.durationNights === 'number' ? docData.durationNights : parseInt(docData.durationNights || '0')
                            const days = typeof docData.durationDays === 'number' ? docData.durationDays : parseInt(docData.durationDays || '0')
                            if (nights > 0 && !destPackagesOptions[dest].find(o => o.nights === nights)) {
                                destPackagesOptions[dest].push({
                                    nights,
                                    label: days > 0 ? `${days} Days / ${nights} Nights` : `${nights} Nights`
                                })
                            }
                        })
                    })
                } else {
                    // MAIN SITE MODE: fetch from global packages collection
                    const allPackagesSnapshot = await getDocs(collection(db, 'packages'))

                    allPackagesSnapshot.forEach((doc) => {
                        const docData = doc.data()
                        const pkgName = (docData.Destination_Name || '').trim().toLowerCase()
                        const pkgId = (docData.Destination_ID || '').trim().toLowerCase()

                        data.destinations.forEach((dest: string) => {
                            let normalizedDest = dest.trim().toLowerCase()
                            if (!normalizedDest) return;
                            if (normalizedDest.includes('andaman')) normalizedDest = 'andaman';
                            if (normalizedDest.includes('sri lanka') || normalizedDest.includes('sri-lanka')) normalizedDest = 'sri lanka';

                            const hasMatch = (pkgName && (pkgName.includes(normalizedDest) || normalizedDest.includes(pkgName))) ||
                                             (pkgId && (pkgId.includes(normalizedDest) || normalizedDest.includes(pkgId)));

                            if (hasMatch) {
                                let firstDayLocation = dest
                                const itineraryDetails = docData.Day_Wise_Itinerary_Details
                                if (Array.isArray(itineraryDetails) && itineraryDetails.length > 0) {
                                    const firstDay = itineraryDetails[0]
                                    firstDayLocation =
                                        firstDay.location || firstDay.Location ||
                                        firstDay.city || firstDay.City ||
                                        firstDay.place || firstDay.Place ||
                                        firstDay.title || firstDay.Title ||
                                        dest
                                } else if (typeof docData.Day_Wise_Itinerary === 'string') {
                                    const match = docData.Day_Wise_Itinerary.match(/Day\s*1\s*[:\-\s]+([^|,\n]+)/i)
                                    if (match) firstDayLocation = match[1].trim()
                                }

                                const image =
                                    docData.Primary_Image_URL ||
                                    docData.Image_URL ||
                                    (Array.isArray(docData.Images) && docData.Images[0]) ||
                                    FALLBACK_IMAGE

                                matchingPackagesByDest[dest].push({
                                    id: doc.id,
                                    name: docData.Destination_Name || dest,
                                    packageTitle: docData.Package_Name || docData.Destination_Name || dest,
                                    location: firstDayLocation,
                                    image,
                                    dest,
                                    starCategory: docData.Star_Category || '',
                                    duration: docData.Duration || '',
                                })

                                let nights = docData.Duration_Nights
                                if (!nights && docData.Duration) {
                                    const match = String(docData.Duration).match(/(\d+)\s*[Nn]ight/)
                                    if (match) nights = parseInt(match[1])
                                }

                                let days = docData.Duration_Days
                                if (!days && docData.Duration) {
                                    const match = String(docData.Duration).match(/(\d+)\s*[Dd]ay/)
                                    if (match) days = parseInt(match[1])
                                }

                                if (nights) {
                                    const parsedNights = typeof nights === 'string' ? parseInt(nights) : nights
                                    if (!destPackagesOptions[dest].find(o => o.nights === parsedNights)) {
                                        destPackagesOptions[dest].push({
                                            nights: parsedNights,
                                            label: days ? `${days} Days / ${parsedNights} Nights` : `${parsedNights} Nights`
                                        })
                                    }
                                }
                            }
                        })
                    })
                }

                // --- Smart Package Selection per Destination ---
                const collectedPackages: any[] = []

                data.destinations.forEach((dest: string) => {
                    const allForDest = [...(matchingPackagesByDest[dest] || [])]

                    // Fisher-Yates shuffle for genuine randomness each session
                    for (let i = allForDest.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [allForDest[i], allForDest[j]] = [allForDest[j], allForDest[i]]
                    }

                    const seenLocations = new Set<string>()
                    const sampledForDest: any[] = []

                    for (const pkg of allForDest) {
                        const locationKey = (pkg.location || '').trim().toLowerCase()
                        if (locationKey && !seenLocations.has(locationKey)) {
                            seenLocations.add(locationKey)
                            sampledForDest.push(pkg)
                        }
                        if (sampledForDest.length >= 10) break
                    }

                    collectedPackages.push(...sampledForDest)
                })

                // Sort options by nights and set fallbacks
                const newRouteItems = [...routeItems]
                let shouldUpdateRouteItems = false

                Object.keys(destPackagesOptions).forEach((dest) => {
                    destPackagesOptions[dest].sort((a, b) => a.nights - b.nights)

                    if (destPackagesOptions[dest].length === 0) {
                        destPackagesOptions[dest] = [
                            { nights: 2, label: '3 Days / 2 Nights' },
                            { nights: 3, label: '4 Days / 3 Nights' },
                            { nights: 4, label: '5 Days / 4 Nights' },
                            { nights: 5, label: '6 Days / 5 Nights' }
                        ]
                    }

                    const currentItem = newRouteItems.find(item => item.destination === dest)
                    if (currentItem) {
                        const hasMatchingOption = destPackagesOptions[dest].some(opt => opt.nights === currentItem.nights)
                        if (!currentItem.nights || !hasMatchingOption) {
                            currentItem.nights = destPackagesOptions[dest][0].nights
                            shouldUpdateRouteItems = true
                        }
                    }
                })

                setAvailableOptions(destPackagesOptions)

                const updatePayload: any = { destinationPackages: collectedPackages }
                if (shouldUpdateRouteItems) {
                    updatePayload.routeItems = newRouteItems
                }
                updateData(updatePayload)

            } catch (error) {
                console.error('Error fetching package days:', error)
            } finally {
                setLoading(false)
            }
        }

        if (data.destinations.length > 0) {
            fetchPackageNights()
        } else {
            setLoading(false)
        }
    }, [data.destinations, agentSlug])

    const selectNights = (index: number, nights: number) => {
        const newItems = [...routeItems]
        newItems[index].nights = nights
        updateData({ routeItems: newItems })
    }

    const removeRouteItem = (index: number) => {
        const newItems = [...routeItems]
        newItems.splice(index, 1)

        const newDestinations = newItems.map(i => i.destination)
        updateData({
            routeItems: newItems,
            destinations: newDestinations
        })

        if (newItems.length === 0) {
            onPrev()
        }
    }

    // Group size helpers (DMC mode)
    const groupSize = data.groupSize || { adults: 2, children: 0, infants: 0 }

    const adjustGroupSize = (field: 'adults' | 'children' | 'infants', delta: number) => {
        const min = field === 'adults' ? 1 : 0
        const newVal = Math.max(min, (groupSize[field] || 0) + delta)
        updateData({ groupSize: { ...groupSize, [field]: newVal } })
    }

    const canProceed = routeItems.every((item: any) => item.nights !== null && item.nights > 0)

    return (
        <div className="animate-fade-in-up">
            <div className="text-center mb-8">
                <h2 className="text-3xl sm:text-5xl font-bold text-gray-900 mb-3 tracking-tight">
                    Customize Your Journey
                </h2>
                <p className="text-sm sm:text-lg text-gray-500 font-medium">
                    Select how many nights you'd like at each stop.
                </p>
            </div>

            <div className="max-w-2xl mx-auto space-y-3">

                {loading ? (
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
                        <div className="inline-flex items-center gap-3 text-gray-400 font-medium">
                            <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Finding available packages…
                        </div>
                    </div>
                ) : (
                    <>
                        {routeItems.map((item: any, index: number) => {
                            const options = availableOptions[item.destination] || []
                            const isLast = index === routeItems.length - 1

                            return (
                                <div key={item.id || index}>
                                    {/* Destination card */}
                                    <div className={`bg-white rounded-3xl border-2 overflow-hidden shadow-sm transition-all duration-300 ${
                                        item.nights ? 'border-primary/25 shadow-primary/5 shadow-lg' : 'border-gray-100'
                                    }`}>
                                        {/* Card header */}
                                        <div className="flex items-center gap-4 px-5 py-4 border-b border-gray-50 bg-gradient-to-r from-gray-50/80 to-white">
                                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-[#ff8a3d] text-white flex items-center justify-center font-black text-lg shadow-md flex-shrink-0">
                                                {index + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-black text-gray-900 text-lg tracking-tight truncate" title={item.destination}>
                                                    {item.destination}
                                                </h4>
                                                {item.nights ? (
                                                    <p className="text-xs font-semibold text-primary mt-0.5 flex items-center gap-1">
                                                        🌙 {item.nights} nights selected
                                                    </p>
                                                ) : (
                                                    <p className="text-xs text-amber-500 font-semibold mt-0.5">
                                                        ✦ Choose a duration below
                                                    </p>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => removeRouteItem(index)}
                                                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all flex-shrink-0"
                                                title="Remove destination"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>

                                        {/* Duration tiles */}
                                        <div className="p-5">
                                            {options.length === 0 ? (
                                                <p className="text-sm text-gray-400 italic text-center py-2">No packages available for this destination.</p>
                                            ) : (
                                                <>
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-4">Select Duration</p>
                                                    <div className="flex flex-wrap gap-3">
                                                        {options.map((opt, i) => {
                                                            const isSelected = item.nights === opt.nights
                                                            const parts = opt.label.split('/')
                                                            const daysLabel = parts[0]?.trim() || ''
                                                            return (
                                                                <button
                                                                    key={i}
                                                                    onClick={() => selectNights(index, opt.nights)}
                                                                    className={`relative flex flex-col items-center justify-center w-24 h-24 rounded-2xl border-2 transition-all duration-200 group select-none ${
                                                                        isSelected
                                                                            ? 'bg-gradient-to-br from-primary to-[#ff8a3d] border-transparent shadow-xl shadow-primary/30 scale-105'
                                                                            : 'bg-gray-50 border-gray-100 hover:border-primary/30 hover:bg-primary/5 hover:scale-[1.03] hover:shadow-md'
                                                                    }`}
                                                                >
                                                                    {isSelected && (
                                                                        <span className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center">
                                                                            <svg className="w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                                            </svg>
                                                                        </span>
                                                                    )}
                                                                    <span className="text-xl mb-1 group-hover:scale-110 transition-transform">🌙</span>
                                                                    <span className={`text-2xl font-black leading-none tabular-nums ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                                                                        {opt.nights}
                                                                    </span>
                                                                    <span className={`text-[10px] font-bold uppercase tracking-wide mt-0.5 ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>
                                                                        nights
                                                                    </span>
                                                                    {daysLabel && (
                                                                        <span className={`text-[9px] font-semibold mt-0.5 ${isSelected ? 'text-white/60' : 'text-gray-300'}`}>
                                                                            {daysLabel}
                                                                        </span>
                                                                    )}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Journey connector between cards */}
                                    {!isLast && (
                                        <div className="flex justify-center py-1">
                                            <div className="flex flex-col items-center">
                                                <div className="w-px h-3 bg-gray-200" />
                                                <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </>
                )}

                {/* DMC Mode: Group Size */}
                {isDmcMode && (
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mt-4">
                        <div className="px-5 pt-5 pb-3 border-b border-gray-50">
                            <h3 className="font-black text-gray-900 text-base flex items-center gap-2">
                                <span className="text-lg">👥</span> Group Size
                            </h3>
                            <p className="text-xs text-gray-400 font-medium mt-0.5">For reference — won't affect package search</p>
                        </div>
                        <div className="grid grid-cols-3 p-4 gap-3">
                            {([
                                { field: 'adults',   label: 'Adults',   sub: 'Age 12+', emoji: '🧑', min: 1 },
                                { field: 'children', label: 'Children', sub: 'Age 2–11', emoji: '👦', min: 0 },
                                { field: 'infants',  label: 'Infants',  sub: 'Under 2',  emoji: '👶', min: 0 },
                            ] as const).map(({ field, label, sub, emoji, min }) => (
                                <div key={field} className="flex flex-col items-center py-4 px-2 bg-gray-50 rounded-2xl">
                                    <span className="text-2xl mb-1">{emoji}</span>
                                    <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">{label}</span>
                                    <span className="text-[9px] text-gray-400 mb-3">{sub}</span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => adjustGroupSize(field, -1)}
                                            disabled={(groupSize[field] || 0) <= min}
                                            className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:border-primary hover:text-primary transition-all disabled:opacity-30 disabled:cursor-not-allowed font-bold text-lg shadow-sm"
                                        >
                                            −
                                        </button>
                                        <span className="w-8 text-center font-black text-2xl text-gray-900 tabular-nums">
                                            {groupSize[field] || 0}
                                        </span>
                                        <button
                                            onClick={() => adjustGroupSize(field, 1)}
                                            className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:border-primary hover:text-primary transition-all font-bold text-lg shadow-sm"
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>

            <div className="mt-8 flex justify-center gap-3">
                <button
                    onClick={onPrev}
                    disabled={isSubmitting}
                    className="px-8 py-3 bg-white text-gray-700 border-2 border-gray-200 rounded-full font-bold text-base hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm disabled:opacity-50"
                >
                    ← Back
                </button>
                <button
                    onClick={onNext}
                    disabled={!canProceed || loading || isSubmitting}
                    className="px-10 py-3 bg-gray-900 text-white rounded-full font-bold text-base shadow-xl hover:shadow-2xl hover:bg-gray-800 hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {isSubmitting ? (
                        <>
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Creating Itinerary…
                        </>
                    ) : loading ? (
                        'Please wait…'
                    ) : isDmcMode ? (
                        'Generate Itinerary ✨'
                    ) : (
                        'Group Details →'
                    )}
                </button>
            </div>
        </div>
    )
}
