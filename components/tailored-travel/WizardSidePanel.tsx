'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'

const MapComponent = dynamic(() => import('./LeafletMap'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 rounded-2xl border border-gray-200 shadow-inner">
            <span className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></span>
            <p className="mt-4 text-gray-400 text-sm font-bold tracking-widest uppercase">Initializing Map...</p>
        </div>
    )
})

function pkgHasHotel(starCategory: string): boolean {
    const star = (starCategory || '').trim().toLowerCase()
    return !!star && star !== 'none'
}

export default function WizardSidePanel({
    currentStep,
    data
}: {
    currentStep: number,
    data: any
}) {
    const routeItems = data.routeItems.length > 0
        ? data.routeItems
        : data.destinations.map((d: string, index: number) => ({
            id: `summary-route-${index}`,
            destination: d,
            nights: 0,
        }))

    const allPackages: any[] = data.destinationPackages || []
    const includedCities: string[] = data.includedCities || []
    const hotelIncluded: boolean | null = data.hotelIncluded ?? null
    const hotelTypes: string[] = data.hotelTypes || []
    const selectedNights: number = data.routeItems?.[0]?.nights || 0

    // Filter packages to exactly what the user has selected so the map reflects their choices
    const filteredPackages = useMemo(() => {
        let pkgs = [...allPackages]

        // 1. City filter
        if (includedCities.length > 0) {
            pkgs = pkgs.filter(pkg => {
                const itin = (pkg.dayWiseItinerary || '').toLowerCase()
                return includedCities.some((c: string) => itin.includes(c.toLowerCase()))
            })
        }

        // 2. Hotel filter using starCategory field
        if (hotelIncluded === false) {
            pkgs = pkgs.filter(pkg => !pkgHasHotel(pkg.starCategory))
        } else if (hotelIncluded === true) {
            pkgs = pkgs.filter(pkg => pkgHasHotel(pkg.starCategory))
            if (hotelTypes.length > 0) {
                pkgs = pkgs.filter(pkg => {
                    const star = (pkg.starCategory || '').toLowerCase()
                    return hotelTypes.some((t: string) => star === t.toLowerCase())
                })
            }
        }

        // 3. Nights filter — exact match first, then ±1 fallback
        if (selectedNights > 0) {
            const exact = pkgs.filter(pkg => Number(pkg.durationNights) === selectedNights)
            if (exact.length > 0) {
                pkgs = exact
            } else {
                const near = pkgs.filter(pkg => Math.abs(Number(pkg.durationNights) - selectedNights) <= 1)
                if (near.length > 0) pkgs = near
            }
        }

        return pkgs
    }, [allPackages.length, includedCities.join(','), hotelIncluded, hotelTypes.join(','), selectedNights])

    // Build map summary label
    const mapSubtitle = useMemo(() => {
        if (filteredPackages.length > 0 && selectedNights > 0) {
            return `${filteredPackages.length} package${filteredPackages.length !== 1 ? 's' : ''} · ${selectedNights} nights`
        }
        if (filteredPackages.length > 0) {
            return `${filteredPackages.length} package${filteredPackages.length !== 1 ? 's' : ''} available`
        }
        if (routeItems.length > 0) return 'A personalized map of your tailored trip.'
        return 'Your map is currently empty.'
    }, [filteredPackages.length, selectedNights, routeItems.length])

    return (
        <div className="flex w-full lg:w-[45%] bg-white/90 sm:bg-white/80 backdrop-blur-3xl border border-gray-200/50 shadow-2xl shadow-gray-200/50 rounded-3xl sm:rounded-[2.5rem] p-4 sm:p-5 lg:p-6 text-gray-900 flex-col relative overflow-hidden h-[500px] lg:h-auto lg:flex-1 mt-6 lg:mt-0 z-10">
            <div className="absolute inset-0 opacity-[0.03] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTQwIDBMMCAwIDAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzAwMDAwMCIgc3Ryb2tlLXdpZHRoPSIxIiBvcGFjaXR5PSIwLjIiLz48L3N2Zz4=')] pointer-events-none"></div>

            <div className="relative z-10 flex flex-col h-full w-full">
                <div className="mb-3 sm:mb-5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <svg className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                        <div>
                            <h3 className="text-base sm:text-xl font-bold drop-shadow-sm leading-tight">Live Journey Map</h3>
                            <p className="text-[10px] sm:text-xs text-gray-500 font-medium">{mapSubtitle}</p>
                        </div>
                    </div>
                    {filteredPackages.length > 0 && currentStep === 2 && (
                        <span className="text-[10px] font-bold text-primary bg-primary/8 px-2.5 py-1 rounded-full flex-shrink-0">
                            {filteredPackages.length} shown
                        </span>
                    )}
                </div>

                <div className="relative w-full h-[400px] lg:h-full lg:flex-1 rounded-2xl overflow-hidden border border-gray-200 shadow-inner">
                    <MapComponent
                        mainDestination={routeItems[0]?.destination}
                        mainDestinationSubtitle={routeItems[0]?.nights ? `${routeItems[0].nights} Nights` : undefined}
                        itinerary={routeItems.length > 1 ? routeItems.slice(1).map((item: any) => ({
                            title: item.destination,
                            day: item.nights ? `${item.nights} Nights` : undefined
                        })) : []}
                        hideCarAnimation={true}
                        userOrigin={data.userOrigin}
                        packages={currentStep === 2 ? filteredPackages : allPackages}
                        hotelTypes={hotelTypes}
                        currentStep={currentStep}
                    />
                </div>
            </div>
        </div>
    )
}
