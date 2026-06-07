'use client'

import { useMemo, useState, useRef } from 'react'

const HOTEL_STAR_OPTIONS = [
  { id: '3-star', label: '3-Star', desc: 'Comfortable', stars: 3 },
  { id: '4-star', label: '4-Star', desc: 'Premium',     stars: 4 },
  { id: '5-star', label: '5-Star', desc: 'Luxury',      stars: 5 },
]

function packageHasHotel(pkg: any): boolean {
  const star = (pkg.starCategory || '').trim().toLowerCase()
  return !!star && star !== 'none'
}

function filterPackages(
  allPackages: any[],
  selectedNights: number,
  includedCities: string[],
  hotelIncluded: boolean | null,
  hotelTypes: string[],
) {
  let pkgs = allPackages

  // Filter by nights first (already selected in step 1)
  if (selectedNights > 0) {
    pkgs = pkgs.filter(pkg => Number(pkg.durationNights) === selectedNights)
  }

  if (includedCities.length > 0) {
    pkgs = pkgs.filter(pkg => {
      const itinerary = (pkg.dayWiseItinerary || '').toLowerCase()
      const hotelCities = (Array.isArray(pkg.hotels) ? pkg.hotels : [])
        .map((h: any) => (h.destination || '').toLowerCase())
      return includedCities.every(city =>
        itinerary.includes(city.toLowerCase()) ||
        hotelCities.some((hc: string) => hc.includes(city.toLowerCase()))
      )
    })
  }

  if (hotelIncluded === false) {
    pkgs = pkgs.filter(pkg => !packageHasHotel(pkg))
  } else if (hotelIncluded === true) {
    pkgs = pkgs.filter(pkg => packageHasHotel(pkg))
    if (hotelTypes.length > 0) {
      pkgs = pkgs.filter(pkg => {
        const star = (pkg.starCategory || '').toLowerCase()
        return hotelTypes.some(type => star === type.toLowerCase())
      })
    }
  }

  return pkgs
}

function StarRow({ count, active }: { count: number; active: boolean }) {
  if (count === 0) return <span className={`text-[10px] font-bold ${active ? 'text-primary' : 'text-gray-400'}`}>Home</span>
  return (
    <div className="flex gap-px">
      {Array.from({ length: Math.min(count, 5) }).map((_, i) => (
        <svg key={i} className={`w-3 h-3 ${active ? 'text-amber-400' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

export default function StepDmc2Cities({
  data,
  updateData,
  onNext,
  onPrev,
  isSubmitting,
}: {
  data: any
  updateData: (d: any) => void
  onNext: () => void
  onPrev: () => void
  isSubmitting?: boolean
}) {
  const allPackages: any[] = data.destinationPackages || []
  const includedCities: string[] = data.includedCities || []
  const hotelIncluded: boolean | null = data.hotelIncluded ?? null
  const hotelTypes: string[] = data.hotelTypes || []
  const selectedNights: number = data.routeItems?.[0]?.nights || 0
  const groupSize = data.groupSize || { adults: 2, children: 0, infants: 0 }

  const travelDate = (!['Flexible', 'Next Month', 'Within 3 Months', 'Decided Dates'].includes(data.dateRange) && data.dateRange)
    ? data.dateRange : ''

  const [showPaxLocked, setShowPaxLocked] = useState(false)
  const paxLockTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handlePaxLockedClick = () => {
    setShowPaxLocked(true)
    if (paxLockTimer.current) clearTimeout(paxLockTimer.current)
    paxLockTimer.current = setTimeout(() => setShowPaxLocked(false), 3000)
  }

  const matchingPackages = useMemo(
    () => filterPackages(allPackages, selectedNights, includedCities, hotelIncluded, hotelTypes),
    [allPackages.length, selectedNights, includedCities.join(','), hotelIncluded, hotelTypes.join(',')]
  )

  const setHotelIncluded = (value: boolean) => {
    updateData({
      hotelIncluded: value,
      hotelTypes: value ? (data.hotelTypes?.length > 0 ? data.hotelTypes : ['4-star']) : [],
    })
  }

  const toggleHotelStar = (id: string) => {
    const current = new Set(data.hotelTypes as string[])
    if (current.has(id)) current.delete(id)
    else current.add(id)
    updateData({ hotelTypes: Array.from(current) })
  }

  const adjust = (field: 'adults' | 'children' | 'infants', delta: number) => {
    const min = field === 'adults' ? 1 : 0
    const newVal = Math.max(min, (groupSize[field] || 0) + delta)
    updateData({
      groupSize: { ...groupSize, [field]: newVal },
      passengers: {
        adults: field === 'adults' ? newVal : groupSize.adults,
        kids: field === 'children' ? newVal : groupSize.children,
        rooms: Math.max(1, Math.ceil((field === 'adults' ? newVal : groupSize.adults) / 2)),
      },
    })
  }

  const totalTravelers = (groupSize.adults || 0) + (groupSize.children || 0) + (groupSize.infants || 0)
  const noPackagesFound = hotelIncluded !== null && matchingPackages.length === 0
  const canSubmit = hotelIncluded !== null

  // Packages that match nights + cities but ignore hotel filter — shown when hotel filter yields 0
  const packagesIgnoringHotel = useMemo(
    () => filterPackages(allPackages, selectedNights, includedCities, null, []),
    [allPackages.length, selectedNights, includedCities.join(',')]
  )

  const paxRows = [
    { field: 'adults'   as const, label: 'Adults',   sub: 'Age 12+',  min: 1 },
    { field: 'children' as const, label: 'Children', sub: 'Age 2–11', min: 0 },
    { field: 'infants'  as const, label: 'Infants',  sub: 'Under 2',  min: 0 },
  ]

  return (
    <div className="animate-fade-in-up">
      <div className="text-center mb-5">
        <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-1.5 tracking-tight">
          Package Details
        </h2>
        <p className="text-xs sm:text-base text-gray-500 font-medium px-2">
          Set your travel date, hotel preference, and group size.
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-2.5">

        {/* ── Selection summary from step 1 ── */}
        {selectedNights > 0 && (
          <div className="bg-primary/5 rounded-2xl px-4 py-3 flex items-center gap-3 border border-primary/10">
            <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
            <p className="text-xs font-semibold text-primary">
              {data.destinations?.[0]} · {selectedNights} nights
              {includedCities.length > 0 && ` · ${includedCities.join(', ')}`}
              {(data.pickupCity || data.dropCity) && ` · ${data.pickupCity || ''}${data.dropCity ? ` → ${data.dropCity}` : ''}`}
            </p>
          </div>
        )}

        {/* ── Section 5: Travel Date ── */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow-sm shadow-primary/30">
                <span className="text-[9px] font-black text-white">5</span>
              </div>
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.15em]">Travel Date</span>
              <span className="text-[9px] text-gray-300 font-semibold">optional</span>
            </div>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors pointer-events-none">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={travelDate}
                onChange={e => updateData({ dateRange: e.target.value })}
                onClick={e => { try { (e.target as HTMLInputElement).showPicker?.() } catch {} }}
                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:bg-white focus:border-primary/30 focus:ring-4 focus:ring-primary/8 transition-all font-semibold text-gray-900 outline-none cursor-pointer"
              />
            </div>
            {travelDate && (
              <p className="mt-2 text-xs text-primary font-semibold pl-1 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
                {new Date(travelDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
        </div>

        {/* ── Section 6: Hotel Preference ── */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow-sm shadow-primary/30">
                  <span className="text-[9px] font-black text-white">6</span>
                </div>
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.15em]">Hotel Preference</span>
              </div>
              {hotelIncluded !== null && (
                <span className="text-[10px] font-bold text-primary bg-primary/8 px-2.5 py-1 rounded-full">
                  {matchingPackages.length} package{matchingPackages.length !== 1 ? 's' : ''} match
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={() => setHotelIncluded(false)}
                className={`relative flex flex-col items-center gap-1.5 py-3 px-3 rounded-2xl border-2 transition-all duration-200 select-none text-left ${
                  hotelIncluded === false
                    ? 'bg-sky-50 border-sky-400 shadow-md shadow-sky-100 scale-[1.02]'
                    : 'bg-gray-50 border-gray-100 hover:border-gray-200 hover:bg-gray-100'
                }`}
              >
                {hotelIncluded === false && (
                  <span className="absolute top-2 right-2 w-4 h-4 bg-sky-500 rounded-full flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${hotelIncluded === false ? 'bg-sky-100' : 'bg-gray-100'}`}>
                  🏕️
                </div>
                <div>
                  <p className={`text-sm font-black text-center ${hotelIncluded === false ? 'text-sky-700' : 'text-gray-700'}`}>Without Hotel</p>
                  <p className={`text-[10px] text-center ${hotelIncluded === false ? 'text-sky-400' : 'text-gray-400'}`}>Land only package</p>
                </div>
              </button>

              <button
                onClick={() => setHotelIncluded(true)}
                className={`relative flex flex-col items-center gap-1.5 py-3 px-3 rounded-2xl border-2 transition-all duration-200 select-none text-left ${
                  hotelIncluded === true
                    ? 'bg-primary/8 border-primary shadow-md shadow-primary/15 scale-[1.02]'
                    : 'bg-gray-50 border-gray-100 hover:border-gray-200 hover:bg-gray-100'
                }`}
              >
                {hotelIncluded === true && (
                  <span className="absolute top-2 right-2 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${hotelIncluded === true ? 'bg-primary/10' : 'bg-gray-100'}`}>
                  🏨
                </div>
                <div>
                  <p className={`text-sm font-black text-center ${hotelIncluded === true ? 'text-gray-900' : 'text-gray-700'}`}>With Hotel</p>
                  <p className={`text-[10px] text-center ${hotelIncluded === true ? 'text-primary' : 'text-gray-400'}`}>Includes accommodation</p>
                </div>
              </button>
            </div>

            {hotelIncluded === true && (
              <div>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] mb-2.5">
                  Star Category <span className="normal-case tracking-normal font-semibold text-gray-300">· pick one or more</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {HOTEL_STAR_OPTIONS.map(opt => {
                    const isSelected = (data.hotelTypes as string[]).includes(opt.id)
                    return (
                      <button
                        key={opt.id}
                        onClick={() => toggleHotelStar(opt.id)}
                        className={`flex items-center gap-2 pl-2.5 pr-3.5 py-2 rounded-xl border-2 transition-all duration-200 select-none ${
                          isSelected
                            ? 'bg-primary/10 border-primary shadow-sm scale-[1.03]'
                            : 'bg-gray-50 border-gray-100 hover:border-primary/20 hover:bg-primary/5'
                        }`}
                      >
                        <StarRow count={opt.stars} active={isSelected} />
                        <span className={`text-xs font-bold ${isSelected ? 'text-gray-900' : 'text-gray-500'}`}>{opt.label}</span>
                        {isSelected && (
                          <svg className="w-3 h-3 text-primary ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Matching packages preview ── */}
        {hotelIncluded !== null && matchingPackages.length > 0 && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-2 flex items-center gap-2 border-b border-gray-50">
              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.15em]">
                {matchingPackages.length} Matching Package{matchingPackages.length !== 1 ? 's' : ''}
              </span>
            </div>
            <ul className="divide-y divide-gray-50">
              {matchingPackages.map((pkg: any) => (
                <li key={pkg.id} className="flex items-center justify-between px-4 py-2.5 gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-800 truncate">{pkg.title || pkg.destination}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {pkg.durationDays}D / {pkg.durationNights}N
                      {pkg.starCategory && pkg.starCategory.toLowerCase() !== 'none' && ` · ${pkg.starCategory}`}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-primary bg-primary/8 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                    {pkg.durationNights}N
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── No exact match: show available packages so user knows what's there ── */}
        {noPackagesFound && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 flex gap-3 items-start">
              <div className="w-7 h-7 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3.5 h-3.5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-amber-800">
                  {hotelIncluded === false ? 'No land-only packages for this selection' : 'No packages match this hotel category'}
                </p>
                <p className="text-xs text-amber-600 mt-0.5 leading-relaxed">
                  {hotelIncluded === false
                    ? <>All available packages include hotel. Switch to <span className="font-bold">With Hotel</span> to proceed.</>
                    : <>Try selecting a different star category below.</>
                  }
                </p>
              </div>
            </div>

            {/* Show available packages (ignoring hotel filter) so user can see what exists */}
            {packagesIgnoringHotel.length > 0 && (
              <div className="border-t border-amber-200 bg-white/60">
                <p className="px-4 pt-2.5 pb-1 text-[10px] font-black text-amber-700 uppercase tracking-[0.12em]">
                  Available packages for {selectedNights} nights
                </p>
                <ul className="divide-y divide-amber-100">
                  {packagesIgnoringHotel.map((pkg: any) => (
                    <li key={pkg.id} className="flex items-center justify-between px-4 py-2 gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-800 truncate">{pkg.title || pkg.destination}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {pkg.durationDays}D / {pkg.durationNights}N
                        </p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${
                        pkg.starCategory && pkg.starCategory.toLowerCase() !== 'none'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {pkg.starCategory && pkg.starCategory.toLowerCase() !== 'none' ? pkg.starCategory : 'Land only'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ── Section 7: PAX ── */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow-sm shadow-primary/30">
                <span className="text-[9px] font-black text-white">7</span>
              </div>
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.15em]">Passengers</span>
              <span className="text-[9px] text-gray-300 font-semibold">optional · default 2</span>
            </div>
            {totalTravelers > 0 && (
              <span className="text-[10px] font-bold text-primary bg-primary/8 px-2.5 py-1 rounded-full">
                {totalTravelers} traveler{totalTravelers !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="divide-y divide-gray-50">
            {paxRows.map(({ field, label, sub }) => (
              <div key={field} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <p className="text-sm font-bold text-gray-800">{label}</p>
                  <p className="text-[10px] text-gray-400 font-medium">{sub}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handlePaxLockedClick}
                    className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-300 cursor-not-allowed font-bold text-base shadow-sm opacity-40"
                  >
                    −
                  </button>
                  <span className="w-7 text-center font-black text-xl text-gray-900 tabular-nums">
                    {groupSize[field] || 0}
                  </span>
                  <button
                    onClick={handlePaxLockedClick}
                    className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-300 cursor-not-allowed font-bold text-base shadow-sm opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          {showPaxLocked && (
            <div className="mx-4 mb-3 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-2xl px-3.5 py-2.5 animate-fade-in-up">
              <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <p className="text-xs text-amber-700 font-semibold leading-snug">
                We only have packages for this group size. Passenger count is fixed based on available packages.
              </p>
            </div>
          )}

          <div className="px-4 py-2.5 bg-gray-50 flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <p className="text-[10px] text-gray-400 font-medium">
              {data.passengers?.rooms || 1} room{(data.passengers?.rooms || 1) !== 1 ? 's' : ''} suggested
              <span className="text-gray-300 ml-1">· based on {groupSize.adults || 2} adults</span>
            </p>
          </div>
        </div>

      </div>

      {/* ── Action buttons ── */}
      <div className="mt-5 flex justify-center gap-3">
        <button
          onClick={onPrev}
          disabled={isSubmitting}
          className="flex items-center gap-2 px-7 py-3 bg-white text-gray-600 border-2 border-gray-200 rounded-full font-bold text-sm hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900 transition-all shadow-sm disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <button
          onClick={onNext}
          disabled={!canSubmit || isSubmitting}
          className={`group flex items-center gap-2.5 px-10 py-3 rounded-full font-bold text-sm transition-all ${
            canSubmit && !isSubmitting
              ? 'bg-primary text-white shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/30 hover:scale-105 cursor-pointer'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
          }`}
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Finding Packages…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Find Best Package
              <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
