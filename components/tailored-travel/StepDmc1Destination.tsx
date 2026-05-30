'use client'

import { useState, useEffect, useRef } from 'react'

interface DestinationOption {
  name: string
  label: string
}

async function extractCitiesWithAI(packages: any[]): Promise<string[]> {
  const itineraries: string[] = packages
    .map(pkg => pkg.dayWiseItinerary || '')
    .filter(Boolean)

  if (itineraries.length === 0) return []

  try {
    const res = await fetch('/api/tailored-travel/extract-cities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itineraries }),
    })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data.cities) ? data.cities : []
  } catch {
    return []
  }
}

export default function StepDmc1Destination({
  data,
  updateData,
  onNext,
  agentSlug,
}: {
  data: any
  updateData: (d: any) => void
  onNext: () => void
  agentSlug: string
}) {
  const [allDestinations, setAllDestinations] = useState<DestinationOption[]>([])
  const [destInput, setDestInput] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [isLoadingDest, setIsLoadingDest] = useState(true)
  const [isLoadingPackages, setIsLoadingPackages] = useState(false)
  const [isLoadingCities, setIsLoadingCities] = useState(false)
  const [pickupDropPairs, setPickupDropPairs] = useState<{ pickup: string; drop: string }[]>([])
  const [isLoadingPickupDrop, setIsLoadingPickupDrop] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isDestSelected = data.destinations.length > 0
  const availableCities: string[] = data.availableCities || []
  const selectedCities: string[] = data.includedCities || []
  const allPackages: any[] = data.destinationPackages || []
  const availableNights: { nights: number; label: string }[] = data.availableNights || []
  const selectedNights: number = data.routeItems?.[0]?.nights || 0

  // Derive ordered routes from hotels data (e.g. "Mount Abu → Udaipur")
  const nightFilteredPkgs = selectedNights > 0
    ? allPackages.filter((pkg: any) => Number(pkg.durationNights) === selectedNights)
    : allPackages

  const availableRoutes = (() => {
    const seen = new Set<string>()
    nightFilteredPkgs.forEach((pkg: any) => {
      const hotels = Array.isArray(pkg.hotels) ? pkg.hotels : []
      const route = hotels.map((h: any) => (h.destination || '').trim()).filter(Boolean).join(' → ')
      if (route) seen.add(route)
    })
    return Array.from(seen).sort()
  })()

  const selectedRoute = availableRoutes.find(route => {
    const routeCities = route.split(' → ').map((s: string) => s.trim())
    return (
      routeCities.length === selectedCities.length &&
      routeCities.every((c: string) => selectedCities.includes(c))
    )
  }) ?? null

  const selectRoute = (route: string) => {
    if (selectedRoute === route) {
      updateData({ includedCities: [] })
    } else {
      const cities = route.split(' → ').map((s: string) => s.trim())
      updateData({ includedCities: cities })
    }
  }

  // Fetch all destinations for this agent on mount
  useEffect(() => {
    async function fetchDest() {
      try {
        const { db } = await import('@/lib/firebase')
        const { collection, getDocs, query, where } = await import('firebase/firestore')
        if (!db) { setIsLoadingDest(false); return }

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
          const name = (d.destination as string || '').trim()
          if (name && !seen.has(name)) {
            seen.add(name)
            options.push({ name, label: d.destinationCountry ? `${name}, ${d.destinationCountry}` : name })
          }
        })
        setAllDestinations(options)
      } catch (err) {
        console.error(err)
      } finally {
        setIsLoadingDest(false)
      }
    }
    fetchDest()
  }, [agentSlug])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Re-extract pickup/drop when nights-filtered + city-filtered packages change
  useEffect(() => {
    if (allPackages.length === 0) {
      setPickupDropPairs([])
      return
    }

    // Filter by selected nights first, then by selected cities
    const nightFilteredPkgs = selectedNights > 0
      ? allPackages.filter(pkg => Number(pkg.durationNights) === selectedNights)
      : allPackages

    const packagesToUse = selectedCities.length > 0
      ? nightFilteredPkgs.filter(pkg => {
          const itinerary = (pkg.dayWiseItinerary || '').toLowerCase()
          const hotelCities = (Array.isArray(pkg.hotels) ? pkg.hotels : [])
            .map((h: any) => (h.destination || '').toLowerCase())
          return selectedCities.some(city =>
            itinerary.includes(city.toLowerCase()) ||
            hotelCities.includes(city.toLowerCase())
          )
        })
      : nightFilteredPkgs

    if (packagesToUse.length === 0) {
      setPickupDropPairs([])
      return
    }

    const itineraries = packagesToUse
      .map(pkg => pkg.dayWiseItinerary || '')
      .filter(Boolean)

    if (itineraries.length === 0) return

    let cancelled = false
    setIsLoadingPickupDrop(true)

    fetch('/api/tailored-travel/extract-pickup-drop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itineraries }),
    })
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        setPickupDropPairs(Array.isArray(d.pairs) ? d.pairs : [])
        updateData({ pickupCity: '', dropCity: '' })
      })
      .catch(() => { if (!cancelled) setPickupDropPairs([]) })
      .finally(() => { if (!cancelled) setIsLoadingPickupDrop(false) })

    return () => { cancelled = true }
  }, [allPackages.length, selectedCities.join(','), selectedNights])

  const filtered = destInput.trim()
    ? allDestinations.filter(d =>
        d.label.toLowerCase().includes(destInput.toLowerCase()) ||
        d.name.toLowerCase().includes(destInput.toLowerCase())
      )
    : allDestinations

  const handleSelect = async (dest: DestinationOption) => {
    setDestInput(dest.label)
    setShowDropdown(false)
    setIsLoadingPackages(true)

    updateData({
      destinations: [dest.name],
      availableCities: [],
      availableNights: [],
      destinationPackages: [],
      includedCities: [],
      routeItems: [],
      pickupCity: '',
      dropCity: '',
    })

    try {
      const { db } = await import('@/lib/firebase')
      const { collection, getDocs, query, where } = await import('firebase/firestore')
      if (!db) { setIsLoadingPackages(false); return }

      const q = query(
        collection(db, 'agent_packages'),
        where('agentSlug', '==', agentSlug),
        where('isActive', '==', true)
      )
      const snap = await getDocs(q)

      const packages: any[] = []
      const nightMap = new Map<number, string>()
      const sel = dest.name.trim().toLowerCase()

      snap.forEach(doc => {
        const d = doc.data()
        const pkgDest = (d.destination || '').trim().toLowerCase()
        if (!pkgDest.includes(sel) && !sel.includes(pkgDest)) return

        packages.push({ id: doc.id, ...d })

        const nights = Number(d.durationNights || 0)
        const days = Number(d.durationDays || 0)
        if (nights > 0 && !nightMap.has(nights)) {
          nightMap.set(nights, days > 0 ? `${days} Days / ${nights} Nights` : `${nights} Nights`)
        }
      })

      const nightsArr = Array.from(nightMap.entries())
        .map(([nights, label]) => ({ nights, label }))
        .sort((a, b) => a.nights - b.nights)

      const defaultNights = nightsArr[0]?.nights || 0

      // Extract cities only from packages matching the default nights selection
      const defaultNightPkgs = defaultNights > 0
        ? packages.filter(p => Number(p.durationNights) === defaultNights)
        : packages

      const cities = await extractCitiesWithAI(defaultNightPkgs)

      updateData({
        destinations: [dest.name],
        availableCities: cities,
        availableNights: nightsArr,
        destinationPackages: packages,
        includedCities: [],
        routeItems: [{ destination: dest.name, nights: defaultNights }],
        pickupCity: '',
        dropCity: '',
      })
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoadingPackages(false)
    }
  }

  const handleRemove = () => {
    setDestInput('')
    updateData({
      destinations: [],
      availableCities: [],
      availableNights: [],
      destinationPackages: [],
      includedCities: [],
      routeItems: [],
      pickupCity: '',
      dropCity: '',
    })
  }

  // When user picks a different nights option, re-extract cities from those packages only
  const selectNights = async (nights: number) => {
    updateData({
      routeItems: [{ destination: data.destinations[0] || '', nights }],
      includedCities: [],
      availableCities: [],
      pickupCity: '',
      dropCity: '',
    })

    const nightPkgs = allPackages.filter(pkg => Number(pkg.durationNights) === nights)
    if (nightPkgs.length === 0) return

    setIsLoadingCities(true)
    try {
      const cities = await extractCitiesWithAI(nightPkgs)
      updateData({ availableCities: cities })
    } finally {
      setIsLoadingCities(false)
    }
  }

  const toggleCity = (city: string) => {
    const current = new Set(selectedCities)
    if (current.has(city)) current.delete(city)
    else current.add(city)
    updateData({ includedCities: Array.from(current) })
  }

  // Pickup/drop derived state
  const pickupSuggestions = Array.from(
    new Set(pickupDropPairs.map(p => p.pickup).filter(Boolean))
  ).sort()

  const chosenPickup = (data.pickupCity || '').trim().toLowerCase()
  const dropSuggestions = chosenPickup
    ? Array.from(
        new Set(
          pickupDropPairs
            .filter(p => p.pickup.toLowerCase() === chosenPickup)
            .map(p => p.drop)
            .filter(Boolean)
        )
      ).sort()
    : []

  const pickupIsSet = !!(data.pickupCity || '').trim()
  const dropIsSet = !!(data.dropCity || '').trim()

  const isLoadingAnything = isLoadingPackages || isLoadingCities

  // Night-filtered package count (for the badge)
  const nightFilteredCount = selectedNights > 0
    ? allPackages.filter(pkg => Number(pkg.durationNights) === selectedNights).length
    : allPackages.length

  return (
    <div className="animate-fade-in-up">
      <div className="text-center mb-5">
        <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-1.5 tracking-tight">
          Plan Your Journey
        </h2>
        <p className="text-xs sm:text-base text-gray-500 font-medium px-2">
          Choose your destination, duration, and cities to visit.
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-2.5">

        {/* ── Section 1: Destination ── */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-visible">
          <div className="px-4 pt-4 pb-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow-sm shadow-primary/30">
                <span className="text-[9px] font-black text-white">1</span>
              </div>
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.15em]">Destination</span>
            </div>

            {isDestSelected ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center gap-2.5 bg-primary text-white pl-4 pr-3 py-2.5 rounded-2xl font-bold shadow-lg shadow-primary/25 text-sm w-fit">
                    <svg className="w-4 h-4 opacity-80 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>{data.destinations[0]}</span>
                    <button
                      onClick={handleRemove}
                      className="w-5 h-5 bg-white/20 rounded-full hover:bg-white/40 flex items-center justify-center transition-colors flex-shrink-0"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {isLoadingPackages ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 rounded-xl w-fit">
                    <svg className="animate-spin w-3.5 h-3.5 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-xs text-primary font-semibold">Loading packages…</span>
                  </div>
                ) : allPackages.length > 0 ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-xl w-fit">
                    <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-xs text-green-700 font-semibold">
                      {allPackages.length} packages found
                    </span>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="relative">
                <div className="relative flex items-center group">
                  <div className="absolute left-4 text-gray-400 group-focus-within:text-primary transition-colors pointer-events-none">
                    {isLoadingDest ? (
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
                    value={destInput}
                    onChange={e => { setDestInput(e.target.value); setShowDropdown(true) }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder={isLoadingDest ? 'Loading destinations…' : 'Search destinations…'}
                    disabled={isLoadingDest}
                    autoComplete="off"
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:bg-white focus:border-primary/30 focus:ring-4 focus:ring-primary/8 transition-all text-base font-medium outline-none text-gray-900 placeholder-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                {!isLoadingDest && allDestinations.length === 0 && (
                  <p className="mt-3 text-sm text-gray-400 text-center py-3 bg-gray-50 rounded-xl">
                    No packages available yet. Please contact the agent.
                  </p>
                )}

                {showDropdown && !isLoadingDest && filtered.length > 0 && (
                  <div ref={dropdownRef} className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl overflow-hidden">
                    <ul className="max-h-52 overflow-y-auto py-1.5">
                      {filtered.map(dest => (
                        <li
                          key={dest.name}
                          onMouseDown={e => { e.preventDefault(); handleSelect(dest) }}
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer text-sm font-medium text-gray-700 hover:bg-primary/5 transition-colors"
                        >
                          <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <svg className="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

        {/* ── Section 2: Package Nights ── */}
        {isDestSelected && !isLoadingPackages && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow-sm shadow-primary/30">
                    <span className="text-[9px] font-black text-white">2</span>
                  </div>
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.15em]">Package Nights</span>
                </div>
                {selectedNights > 0 && (
                  <span className="text-[10px] font-semibold text-gray-400">
                    {nightFilteredCount} package{nightFilteredCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {availableNights.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-4 text-center bg-gray-50 rounded-2xl">
                  No duration options found for this destination.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableNights.map(opt => {
                    const isSelected = selectedNights === opt.nights
                    return (
                      <button
                        key={opt.nights}
                        onClick={() => selectNights(opt.nights)}
                        disabled={isLoadingCities}
                        className={`relative flex flex-col items-center justify-center w-20 h-20 rounded-2xl border-2 transition-all duration-200 group select-none ${
                          isSelected
                            ? 'bg-primary border-transparent shadow-xl shadow-primary/30 scale-[1.06]'
                            : 'bg-gray-50 border-gray-100 hover:border-primary/30 hover:bg-primary/5 hover:scale-[1.03] hover:shadow-md'
                        } disabled:opacity-60 disabled:cursor-not-allowed`}
                      >
                        {isSelected && (
                          <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white rounded-full shadow-md flex items-center justify-center">
                            <svg className="w-3 h-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        )}
                        <svg className={`w-5 h-5 mb-1 transition-transform group-hover:scale-110 ${isSelected ? 'text-white/80' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 20 20">
                          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                        </svg>
                        <span className={`text-2xl font-black leading-none tabular-nums ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                          {opt.nights}
                        </span>
                        <span className={`text-[10px] font-bold uppercase tracking-wide mt-0.5 ${isSelected ? 'text-white/70' : 'text-gray-400'}`}>
                          nights
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {isLoadingCities && (
                <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-primary/5 rounded-xl w-fit">
                  <svg className="animate-spin w-3.5 h-3.5 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-xs text-primary font-semibold">AI extracting cities for {selectedNights}-night packages…</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Section 3: Route ── */}
        {isDestSelected && !isLoadingAnything && selectedNights > 0 && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-4">

              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow-sm shadow-primary/30">
                    <span className="text-[9px] font-black text-white">3</span>
                  </div>
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.15em]">Route</span>
                  <span className="text-[9px] text-gray-300 font-semibold">optional</span>
                </div>
                {selectedRoute && (
                  <button
                    onClick={() => updateData({ includedCities: [] })}
                    className="text-[10px] font-bold text-gray-400 hover:text-gray-600 px-2 py-1 bg-gray-50 rounded-xl transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>

              {availableRoutes.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-4 text-center bg-gray-50 rounded-2xl">
                  No routes found for {selectedNights}-night packages.
                </p>
              ) : (
                <>
                  <p className="text-xs text-gray-400 mb-3">
                    {selectedRoute
                      ? <span>Selected: <span className="font-bold text-primary">{selectedRoute}</span></span>
                      : 'Select a route or leave empty to include all.'}
                  </p>
                  <div className="flex flex-col gap-2">
                    {availableRoutes.map(route => {
                      const isSelected = selectedRoute === route
                      const cities = route.split(' → ')
                      return (
                        <button
                          key={route}
                          onClick={() => selectRoute(route)}
                          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all duration-200 select-none text-left ${
                            isSelected
                              ? 'bg-primary border-transparent text-white shadow-md shadow-primary/20'
                              : 'bg-gray-50 border-gray-100 text-gray-600 hover:border-primary/20 hover:bg-primary/5 hover:text-primary'
                          }`}
                        >
                          <span className="flex items-center gap-1.5 flex-wrap flex-1">
                            {cities.map((city, idx) => (
                              <span key={idx} className="flex items-center gap-1.5">
                                {idx > 0 && (
                                  <svg className={`w-3 h-3 flex-shrink-0 ${isSelected ? 'text-white/70' : 'text-primary/40'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                  </svg>
                                )}
                                {city}
                              </span>
                            ))}
                          </span>
                          {isSelected && (
                            <svg className="w-3.5 h-3.5 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Section 4: Pickup & Drop City ── */}
        {isDestSelected && !isLoadingAnything && selectedNights > 0 && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-4">

              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow-sm shadow-primary/30">
                    <span className="text-[9px] font-black text-white">4</span>
                  </div>
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.15em]">Pickup &amp; Drop</span>
                  <span className="text-[9px] text-gray-300 font-semibold">optional</span>
                </div>
                {isLoadingPickupDrop && (
                  <div className="flex items-center gap-1.5 text-[10px] text-primary font-semibold bg-primary/5 px-2.5 py-1 rounded-full">
                    <svg className="animate-spin w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Analyzing routes…
                  </div>
                )}
              </div>

              {/* Route card */}
              <div className="relative flex gap-4">

                {/* Vertical timeline line */}
                <div className="flex flex-col items-center pt-1 flex-shrink-0">
                  <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 transition-all duration-300 ${
                    pickupIsSet ? 'bg-emerald-500 border-emerald-500 shadow-md shadow-emerald-200' : 'bg-white border-gray-300'
                  }`} />
                  <div className="flex-1 w-0.5 my-1.5 min-h-[60px] bg-gray-200 rounded-full" />
                  <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 transition-all duration-300 ${
                    dropIsSet ? 'bg-rose-500 border-rose-500 shadow-md shadow-rose-200' : 'bg-white border-gray-300'
                  }`} />
                </div>

                {/* Fields */}
                <div className="flex-1 space-y-3">

                  {/* Pickup */}
                  <div>
                    <p className="text-[9px] font-black text-emerald-600 uppercase tracking-[0.15em] mb-1.5">
                      Pickup Point
                    </p>
                    <input
                      type="text"
                      value={data.pickupCity || ''}
                      onChange={e => updateData({ pickupCity: e.target.value, dropCity: '' })}
                      placeholder="e.g. Bagdogra Airport"
                      className="w-full px-4 py-2.5 bg-gray-50 border-2 border-gray-100 rounded-xl focus:bg-white focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50 transition-all text-sm font-medium outline-none text-gray-900 placeholder-gray-300"
                    />
                    {!isLoadingPickupDrop && pickupSuggestions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {pickupSuggestions.map(city => (
                          <button
                            key={city}
                            onClick={() => updateData({ pickupCity: city, dropCity: '' })}
                            className={`text-[11px] font-bold px-3 py-1 rounded-full border-2 transition-all duration-150 ${
                              (data.pickupCity || '').toLowerCase() === city.toLowerCase()
                                ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                                : 'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-200'
                            }`}
                          >
                            {city}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Drop — appears after pickup is set */}
                  {pickupIsSet ? (
                    <div>
                      <p className="text-[9px] font-black text-rose-500 uppercase tracking-[0.15em] mb-1.5 flex items-center gap-1.5">
                        Drop Point
                        {dropSuggestions.length > 0 && (
                          <span className="text-[8px] text-gray-300 normal-case tracking-normal font-semibold">
                            · for packages from {data.pickupCity}
                          </span>
                        )}
                      </p>
                      <input
                        type="text"
                        value={data.dropCity || ''}
                        onChange={e => updateData({ dropCity: e.target.value })}
                        placeholder="e.g. Bagdogra"
                        className="w-full px-4 py-2.5 bg-gray-50 border-2 border-gray-100 rounded-xl focus:bg-white focus:border-rose-300 focus:ring-4 focus:ring-rose-50 transition-all text-sm font-medium outline-none text-gray-900 placeholder-gray-300"
                      />
                      {dropSuggestions.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {dropSuggestions.map(city => (
                            <button
                              key={city}
                              onClick={() => updateData({ dropCity: city })}
                              className={`text-[11px] font-bold px-3 py-1 rounded-full border-2 transition-all duration-150 ${
                                (data.dropCity || '').toLowerCase() === city.toLowerCase()
                                  ? 'bg-rose-500 border-rose-500 text-white shadow-sm'
                                  : 'bg-rose-50 border-rose-100 text-rose-600 hover:bg-rose-100 hover:border-rose-200'
                              }`}
                            >
                              {city}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-[10px] text-gray-300 font-medium">
                          No route found from {data.pickupCity} — type a drop city manually.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="py-3 px-4 bg-gray-50 rounded-xl border-2 border-dashed border-gray-100">
                      <p className="text-[11px] text-gray-300 font-medium text-center">
                        Drop city appears after you set a pickup point
                      </p>
                    </div>
                  )}

                </div>
              </div>

            </div>
          </div>
        )}

      </div>

      <div className="mt-5 flex justify-center">
        <button
          onClick={onNext}
          disabled={!isDestSelected || isLoadingAnything || selectedNights === 0}
          className="group px-10 py-3.5 bg-gray-900 text-white rounded-full font-bold text-base shadow-xl hover:shadow-2xl hover:bg-gray-800 hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <span>Continue</span>
          <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
