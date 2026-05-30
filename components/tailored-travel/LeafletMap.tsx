'use client'

import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polyline, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useState, useRef, useMemo } from 'react'

// Fix for default marker icons in Leaflet with Next.js
const icon = L.icon({
    iconUrl: '/images/marker-icon.png', // We'll need to use default or custom
    iconRetinaUrl: '/images/marker-icon-2x.png',
    shadowUrl: '/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28],
    shadowSize: [41, 41]
});

// Create a custom pulsing dot icon for our theme
const customDotIcon = L.divIcon({
    className: 'custom-map-marker',
    html: `
        <div class="relative flex items-center justify-center w-6 h-6">
            <div class="absolute inset-0 bg-primary rounded-full animate-ping opacity-70"></div>
            <div class="relative w-4 h-4 bg-white border-2 border-primary rounded-full shadow-md z-10"></div>
        </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
})

// Create a premium sleek Day marker icon
const createNumberedIcon = (numStr: string, isBase: boolean = false) => {
    return L.divIcon({
        className: 'custom-map-marker',
        html: `
            <div class="relative flex flex-col items-center justify-center transition-transform duration-300 hover:scale-[1.15] hover:-translate-y-1 pb-2 group">
                <div class="bg-white/95 backdrop-blur-md rounded-[12px] shadow-[0_8px_20px_rgba(0,0,0,0.12)] border border-gray-100 flex items-center justify-center cursor-pointer px-3 py-1.5 min-w-[64px] gap-2">
                    <span class="w-1.5 h-1.5 rounded-full ${isBase ? 'bg-indigo-500' : 'bg-[#ff8a3d]'} shadow-sm"></span>
                    <span class="text-gray-900 font-bold text-[11px] uppercase tracking-wider">${isBase ? 'Base' : 'Day ' + numStr}</span>
                </div>
                <!-- Sleek drop arrow -->
                <div class="absolute bottom-[2px] w-3.5 h-3.5 bg-white/95 rotate-45 z-0 border-r border-b border-gray-100 shadow-[2px_2px_4px_rgba(0,0,0,0.04)]"></div>
            </div>
        `,
        iconSize: [80, 48],
        iconAnchor: [40, 48],
        popupAnchor: [0, -48],
    })
}

// User Location icon (Green pulse)
const userLocationIcon = L.divIcon({
    className: 'user-location-marker',
    html: `
        <div class="relative flex items-center justify-center w-6 h-6">
            <div class="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-70"></div>
            <div class="relative w-4 h-4 bg-white border-2 border-green-500 rounded-full shadow-md z-10"></div>
        </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
})

// Auto-bounds hook to adjust map view when points change
function MapBounds({ positions, focusZoom = 6 }: { positions: [number, number][], focusZoom?: number }) {
    const map = useMap()

    // Fix for Leaflet black-screen bug: invalidate at several delays AND watch container resize
    useEffect(() => {
        // Fire immediately and at increasing intervals so tiles always repaint
        const t1 = setTimeout(() => map.invalidateSize(), 0)
        const t2 = setTimeout(() => map.invalidateSize(), 150)
        const t3 = setTimeout(() => map.invalidateSize(), 400)
        const t4 = setTimeout(() => map.invalidateSize(), 800)

        // Also watch the container for any CSS-driven resize (flex, height changes)
        const container = map.getContainer()
        let ro: ResizeObserver | null = null
        if (typeof ResizeObserver !== 'undefined') {
            ro = new ResizeObserver(() => map.invalidateSize())
            ro.observe(container)
        }

        return () => {
            clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4)
            ro?.disconnect()
        }
    }, [map])

    // Stabilize positions to prevent map bounce on every render
    const stablePositions = useMemo(() => JSON.stringify(positions), [positions])

    useEffect(() => {
        const parsedPositions = JSON.parse(stablePositions) as [number, number][]
        if (parsedPositions.length > 0) {
            const bounds = L.latLngBounds(parsedPositions)
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: focusZoom })
        } else {
            // Default center if no points
            map.setView([20, 0], 2)
        }
    }, [stablePositions, map, focusZoom])

    return null
}

// Performant Animated Airplane Marker that travels along the route
function AirplaneMarker({ routePath }: { routePath: [number, number][] }) {
    const markerRef = useRef<L.Marker>(null)

    // Set up the static airplane icon once
    const airplaneIcon = useMemo(() => {
        return L.divIcon({
            className: 'airplane-marker-container clear-background',
            html: `
            <div class="airplane-ik-inner" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.5)); transition: transform 0.1s linear;">
                <svg viewBox="0 0 24 24" fill="#6366f1" stroke="white" stroke-width="1.5" style="width: 32px; height: 32px;">
                    <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
                </svg>
            </div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
        })
    }, [])

    // Ensure animation doesn't reset due to parent re-renders passing new array refs
    const stableRoutePathStr = useMemo(() => JSON.stringify(routePath), [routePath])

    useEffect(() => {
        const path = JSON.parse(stableRoutePathStr) as [number, number][];
        if (path.length < 2) return

        let animationFrameId: number;
        let startTimestamp: number | null = null;

        // Settings
        const durationPerSegment = 3000; // ms to travel between each stop
        const totalDuration = (path.length - 1) * durationPerSegment;

        const animate = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const elapsed = timestamp - startTimestamp;

            // Loop progress with a tiny pause at the end
            const loopTime = totalDuration + 1500;
            const currentLoopElapsed = elapsed % loopTime;

            if (currentLoopElapsed > totalDuration) {
                // We are in the pause phase, jump to exact end
                if (markerRef.current) {
                    markerRef.current.setLatLng(path[path.length - 1]);
                }
                animationFrameId = requestAnimationFrame(animate);
                return;
            }

            const progress = currentLoopElapsed / totalDuration; // 0.0 to 1.0

            const currentSegmentFloat = progress * (path.length - 1);
            const currentSegment = Math.floor(currentSegmentFloat);
            const segmentProgress = currentSegmentFloat - currentSegment;

            const startPoint = path[currentSegment];
            const endPoint = path[currentSegment + 1];

            if (startPoint && endPoint && markerRef.current) {
                // Interpolate position
                const lat = startPoint[0] + (endPoint[0] - startPoint[0]) * segmentProgress;
                const lng = startPoint[1] + (endPoint[1] - startPoint[1]) * segmentProgress;

                // Calculate Rotation Angle
                const dy = endPoint[0] - startPoint[0];
                const dx = (endPoint[1] - startPoint[1]) * Math.cos(startPoint[0] * Math.PI / 180);
                const angle = Math.atan2(dx, dy) * (180 / Math.PI);

                // Extremely fast imperative update bypassing React's render cycle
                markerRef.current.setLatLng([lat, lng]);

                const innerEl = markerRef.current.getElement()?.querySelector('.airplane-ik-inner') as HTMLElement;
                if (innerEl) {
                    innerEl.style.transform = `rotate(${angle}deg)`;
                }
            }

            animationFrameId = requestAnimationFrame(animate);
        };

        animationFrameId = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [stableRoutePathStr])

    if (routePath.length < 2) return null;

    return <Marker ref={markerRef} position={routePath[0]} icon={airplaneIcon} zIndexOffset={1000} />
}

// Animated Taxi Marker — proper yellow cab with checkerboard stripe
function CarMarker({ routePath }: { routePath: [number, number][] }) {
    const markerRef = useRef<L.Marker>(null)

    const carIcon = useMemo(() => {
        return L.divIcon({
            className: 'taxi-marker-container',
            html: `
            <style>
              @keyframes taxi-glow {
                0%,100% { filter: drop-shadow(0 0 5px rgba(251,191,36,0.7)) drop-shadow(0 3px 8px rgba(0,0,0,0.35)); }
                50%      { filter: drop-shadow(0 0 10px rgba(251,191,36,1))   drop-shadow(0 3px 8px rgba(0,0,0,0.35)); }
              }
              @keyframes taxi-shadow {
                0%,100% { transform: scaleX(1); opacity: 0.3; }
                50%      { transform: scaleX(0.82); opacity: 0.18; }
              }
            </style>
            <div class="taxi-inner" style="
                position: relative;
                display: flex;
                flex-direction: column;
                align-items: center;
                transition: transform 0.12s linear;
            ">
              <svg viewBox="0 0 48 88" style="width:30px;height:55px;animation:taxi-glow 2s ease-in-out infinite;" fill="none" xmlns="http://www.w3.org/2000/svg">
                <!-- Car body (yellow) -->
                <rect x="3" y="14" width="42" height="62" rx="9" fill="#FBBF24"/>
                <!-- Front bumper -->
                <rect x="7" y="11" width="34" height="7" rx="3.5" fill="#D97706"/>
                <!-- Rear bumper -->
                <rect x="7" y="74" width="34" height="6" rx="3" fill="#D97706"/>
                <!-- Front windshield -->
                <rect x="9" y="18" width="30" height="14" rx="4" fill="#BAE6FD" opacity="0.85"/>
                <!-- Windshield glare -->
                <rect x="11" y="20" width="10" height="5" rx="2" fill="white" opacity="0.35"/>
                <!-- Cabin roof (darker yellow) -->
                <rect x="8" y="33" width="32" height="24" rx="3" fill="#D97706"/>
                <!-- TAXI sign (black with yellow text) -->
                <rect x="11" y="35" width="26" height="10" rx="2.5" fill="#111827"/>
                <text x="24" y="43.5" text-anchor="middle" fill="#FBBF24" font-size="7.5" font-weight="900" font-family="Arial,sans-serif" letter-spacing="1">TAXI</text>
                <!-- Left side window -->
                <rect x="9" y="46" width="12" height="9" rx="2" fill="#BAE6FD" opacity="0.6"/>
                <!-- Right side window -->
                <rect x="27" y="46" width="12" height="9" rx="2" fill="#BAE6FD" opacity="0.6"/>
                <!-- Rear window -->
                <rect x="9" y="59" width="30" height="13" rx="4" fill="#BAE6FD" opacity="0.7"/>
                <!-- Rear window glare -->
                <rect x="11" y="61" width="8" height="4" rx="2" fill="white" opacity="0.25"/>
                <!-- Checkerboard stripe — left -->
                <rect x="3"  y="56" width="4" height="4" fill="#111827"/>
                <rect x="7"  y="56" width="4" height="4" fill="#FBBF24"/>
                <rect x="11" y="56" width="4" height="4" fill="#111827"/>
                <!-- Checkerboard stripe — right -->
                <rect x="41" y="56" width="4" height="4" fill="#111827"/>
                <rect x="37" y="56" width="4" height="4" fill="#FBBF24"/>
                <rect x="33" y="56" width="4" height="4" fill="#111827"/>
                <!-- Front headlights (warm white) -->
                <rect x="3"  y="13" width="10" height="6" rx="3" fill="#FEF9C3"/>
                <rect x="35" y="13" width="10" height="6" rx="3" fill="#FEF9C3"/>
                <!-- Headlight inner glow -->
                <rect x="5"  y="15" width="6" height="3" rx="1.5" fill="white" opacity="0.7"/>
                <rect x="37" y="15" width="6" height="3" rx="1.5" fill="white" opacity="0.7"/>
                <!-- Tail lights (red) -->
                <rect x="3"  y="74" width="10" height="5" rx="2.5" fill="#EF4444"/>
                <rect x="35" y="74" width="10" height="5" rx="2.5" fill="#EF4444"/>
                <!-- Tail light glow -->
                <rect x="5"  y="75" width="6" height="3" rx="1.5" fill="#FCA5A5" opacity="0.6"/>
                <rect x="37" y="75" width="6" height="3" rx="1.5" fill="#FCA5A5" opacity="0.6"/>
                <!-- Wheels (front) -->
                <rect x="0"  y="22" width="7" height="14" rx="3.5" fill="#1F2937"/>
                <rect x="41" y="22" width="7" height="14" rx="3.5" fill="#1F2937"/>
                <!-- Wheels (rear) -->
                <rect x="0"  y="58" width="7" height="14" rx="3.5" fill="#1F2937"/>
                <rect x="41" y="58" width="7" height="14" rx="3.5" fill="#1F2937"/>
                <!-- Wheel rims -->
                <rect x="1"  y="24" width="5" height="10" rx="2.5" fill="#374151"/>
                <rect x="42" y="24" width="5" height="10" rx="2.5" fill="#374151"/>
                <rect x="1"  y="60" width="5" height="10" rx="2.5" fill="#374151"/>
                <rect x="42" y="60" width="5" height="10" rx="2.5" fill="#374151"/>
              </svg>
              <!-- Ground shadow -->
              <div style="
                  width:28px; height:5px;
                  background: rgba(0,0,0,0.22);
                  border-radius:50%;
                  margin-top:-1px;
                  filter: blur(4px);
                  animation: taxi-shadow 2s ease-in-out infinite;
              "></div>
            </div>`,
            iconSize: [30, 62],
            iconAnchor: [15, 62],
        })
    }, [])

    const stableRoutePathStr = useMemo(() => JSON.stringify(routePath), [routePath])

    useEffect(() => {
        const path = JSON.parse(stableRoutePathStr) as [number, number][];
        if (path.length < 2) return

        let animationFrameId: number;
        let startTimestamp: number | null = null;

        // Slower, more elegant pace between itinerary stops
        const durationPerSegment = 3500;
        const totalDuration = (path.length - 1) * durationPerSegment;

        const animate = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const elapsed = timestamp - startTimestamp;

            const loopTime = totalDuration + 2500;
            const currentLoopElapsed = elapsed % loopTime;

            if (currentLoopElapsed > totalDuration) {
                if (markerRef.current) markerRef.current.setLatLng(path[path.length - 1]);
                animationFrameId = requestAnimationFrame(animate);
                return;
            }

            const progress = currentLoopElapsed / totalDuration;
            const currentSegmentFloat = progress * (path.length - 1);
            const currentSegment = Math.floor(currentSegmentFloat);
            // Ease in-out per segment for smoother feel
            const rawT = currentSegmentFloat - currentSegment;
            const segmentProgress = rawT < 0.5 ? 2 * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 2) / 2;

            const startPoint = path[currentSegment];
            const endPoint = path[currentSegment + 1];

            if (startPoint && endPoint && markerRef.current) {
                const lat = startPoint[0] + (endPoint[0] - startPoint[0]) * segmentProgress;
                const lng = startPoint[1] + (endPoint[1] - startPoint[1]) * segmentProgress;

                const dy = endPoint[0] - startPoint[0];
                const dx = (endPoint[1] - startPoint[1]) * Math.cos(startPoint[0] * Math.PI / 180);
                const angle = Math.atan2(dx, dy) * (180 / Math.PI);

                markerRef.current.setLatLng([lat, lng]);

                const innerEl = markerRef.current.getElement()?.querySelector('.taxi-inner') as HTMLElement;
                if (innerEl) innerEl.style.transform = `rotate(${angle}deg)`;
            }

            animationFrameId = requestAnimationFrame(animate);
        };

        animationFrameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrameId);
    }, [stableRoutePathStr])

    if (routePath.length === 0) return null;

    return <Marker ref={markerRef} position={routePath[0]} icon={carIcon} zIndexOffset={1000} />
}

// Premium Circular Package Marker with Image & Pulsing Effect
const createPackageIcon = (imageUrl: string) => {
    return L.divIcon({
        className: 'package-image-marker',
        html: `
            <div class="relative flex flex-col items-center group">
                <!-- Outer Pulse Effect -->
                <div class="absolute -inset-1 bg-primary/30 rounded-full animate-ping opacity-0 group-hover:opacity-100 transition-opacity"></div>
                
                <!-- Main Circular Frame -->
                <div class="w-16 h-16 rounded-full border-[3px] border-white shadow-[0_8px_25px_rgba(0,0,0,0.3)] overflow-hidden transition-all duration-500 group-hover:scale-125 group-hover:-translate-y-2 z-10">
                    <img src="${imageUrl}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" onerror="this.src='https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop&auto=format'" />
                    
                    <!-- Glassy overlay on hover -->
                    <div class="absolute inset-0 bg-gradient-to-t from-primary/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
                
                <!-- Sleek Badge Indicator -->
                <div class="absolute -bottom-1.5 bg-gradient-to-r from-primary to-[#ff8a3d] text-white p-1.5 rounded-full shadow-lg border-2 border-white z-20 scale-90 group-hover:scale-100 transition-transform">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
                </div>
            </div>
        `,
        iconSize: [64, 72],
        iconAnchor: [32, 72],
        popupAnchor: [0, -72],
    })
}

// Real Hotel Package Marker — uses actual package image from Firestore
const createRealHotelIcon = (imageUrl: string, tier: string) => {
    const config: Record<string, { color: string; label: string; ring: string }> = {
        '5-star': { color: '#f59e0b', label: '5★', ring: 'border-amber-400' },
        '4-star': { color: '#6366f1', label: '4★', ring: 'border-indigo-500' },
        '3-star': { color: '#10b981', label: '3★', ring: 'border-emerald-500' },
    };
    const { color, label } = config[tier] || { color: '#6b7280', label: '★' };

    return L.divIcon({
        className: 'real-hotel-marker',
        html: `
            <div class="relative flex flex-col items-center group cursor-pointer">
                <!-- Photo circle -->
                <div class="w-14 h-14 rounded-full overflow-hidden border-[3px] border-white shadow-[0_6px_20px_rgba(0,0,0,0.25)] transition-all duration-400 group-hover:scale-125 group-hover:-translate-y-2 z-10">
                    <img src="${imageUrl}" class="w-full h-full object-cover" onerror="this.src='https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200&h=200&fit=crop&auto=format'" />
                </div>
                <!-- Star tier badge -->
                <div class="absolute -bottom-1 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-md border border-white z-20" style="background:${color}">${label}</div>
            </div>
        `,
        iconSize: [56, 64],
        iconAnchor: [28, 64],
        popupAnchor: [0, -64],
    })
}

interface MapProps {
    mainDestination?: string;
    mainDestinationSubtitle?: string;
    itinerary?: { title: string; day?: string | number }[];
    hideCarAnimation?: boolean;
    userOrigin?: [number, number] | null;
    packages?: any[];
    hotelTypes?: string[];
    currentStep?: number;
}


export default function LeafletMap({
    mainDestination,
    mainDestinationSubtitle,
    itinerary = [],
    hideCarAnimation = false,
    userOrigin,
    packages = [],
    hotelTypes = [],
    currentStep = 1
}: MapProps) {
    const [coordinates, setCoordinates] = useState<{ [key: string]: [number, number] }>({})
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    // 1. Set User Geolocation
    useEffect(() => {
        if (userOrigin) {
            setUserLocation(userOrigin)
        } else {
            // Default fallback
            setUserLocation([28.6139, 77.2090]);
        }
    }, [userOrigin])

    // 2. Fetch Destination Coordinates
    useEffect(() => {
        const fetchCoordinates = async () => {
            setIsLoading(true)
            let hasChanges = false
            const newCoords: { [key: string]: [number, number] } = { ...coordinates }

            // 2A. Collect all places to geocode
            const placesToGeocode = new Set<string>();
            if (mainDestination && !newCoords[mainDestination]) placesToGeocode.add(mainDestination);
            itinerary.forEach(item => {
                if (item.title && !newCoords[item.title]) placesToGeocode.add(item.title);
            });

            // Add package locations to geocode (support both agent & main package field names)
            packages.forEach(pkg => {
                const loc = pkg.destination || pkg.location
                if (loc && !newCoords[loc]) placesToGeocode.add(loc)
            });

            if (placesToGeocode.size === 0) {
                setIsLoading(false)
                return
            }

            // AI/Smart Geocoding for efficiency
            try {
                const pendingList = Array.from(placesToGeocode).map(p => ({ title: p }));
                const res = await fetch('/api/tailored-travel/geocode-itinerary', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        mainDestination: mainDestination || '',
                        itinerary: pendingList
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.coordinates) {
                        for (const [title, coords] of Object.entries(data.coordinates)) {
                            newCoords[title] = coords as [number, number];
                            hasChanges = true;
                        }
                    }
                }
            } catch (e) {
                console.error("Geocoding failed", e);
            }

            if (hasChanges) {
                setCoordinates(newCoords)
            }
            setIsLoading(false)
        }

        fetchCoordinates()
    }, [mainDestination, itinerary, packages, coordinates])

    // 3. Construct Routes
    const mainDestPos = mainDestination ? coordinates[mainDestination] : null;

    const validItineraryPoints = itinerary
        .filter(item => item.title && coordinates[item.title])
        .map(item => ({ ...item, pos: coordinates[item.title] }));

    const flightPath: [number, number][] = [];
    if (userLocation && mainDestPos) {
        flightPath.push(userLocation);
        flightPath.push(mainDestPos);

        if (hideCarAnimation) {
            validItineraryPoints.forEach(pt => {
                const lastPt = flightPath[flightPath.length - 1];
                if (!lastPt || Math.abs(lastPt[0] - pt.pos[0]) > 0.001 || Math.abs(lastPt[1] - pt.pos[1]) > 0.001) {
                    flightPath.push(pt.pos);
                }
            });
        }
    }

    // Taxi route (step 4): use the same spread positions as the day markers,
    // so the taxi always has a full multi-stop path even in single-city trips.
    const carRoute: [number, number][] = [];
    if (currentStep === 4 && validItineraryPoints.length >= 1) {
        const rg: Record<string, number[]> = {}
        validItineraryPoints.forEach((pt, i) => {
            const k = `${Math.round(pt.pos[0] * 80)},${Math.round(pt.pos[1] * 80)}`
            if (!rg[k]) rg[k] = []
            rg[k].push(i)
        })
        validItineraryPoints.forEach((pt, idx) => {
            const k = `${Math.round(pt.pos[0] * 80)},${Math.round(pt.pos[1] * 80)}`
            const grp = rg[k]
            const rank = grp.indexOf(idx)
            if (grp.length > 1) {
                const angle = (rank * (360 / grp.length) - 90) * (Math.PI / 180)
                const r = 0.009
                carRoute.push([
                    pt.pos[0] + Math.sin(angle) * r,
                    pt.pos[1] + Math.cos(angle) * r / Math.cos(pt.pos[0] * Math.PI / 180),
                ])
            } else {
                carRoute.push(pt.pos)
            }
        })
    }

    // Determine all bounds and focus zoom
    const allPositions: [number, number][] = [];
    let focusZoom = 6;

    if (currentStep === 1) {
        if (userLocation) allPositions.push(userLocation);
        if (mainDestPos) allPositions.push(mainDestPos);
        focusZoom = 5; // Macro view for the start
    } else if (currentStep === 2) {
        if (mainDestPos) allPositions.push(mainDestPos);
        // Include jittered marker positions (mirrors rendering logic) for correct bounds
        packages.forEach((pkg, idx) => {
            const locKey = pkg.destination || pkg.location
            const pos = locKey ? coordinates[locKey] : null
            if (!pos) return
            const angle = (idx * (360 / Math.max(packages.length, 1))) * (Math.PI / 180)
            const radius = 0.025
            const jLat = Math.sin(angle) * radius
            const jLng = Math.cos(angle) * radius / Math.cos(pos[0] * Math.PI / 180)
            allPositions.push([pos[0] + jLat, pos[1] + jLng])
        })
        focusZoom = 10;
    } else if (currentStep === 3) {
        if (mainDestPos) allPositions.push(mainDestPos);
        focusZoom = 11; // Wide enough to see hotel districts spread across the city
    } else {
        // Step 4 (results): use spread positions so all day markers are in view
        const posGroups4: Record<string, number[]> = {}
        validItineraryPoints.forEach((pt, i) => {
            const key = `${Math.round(pt.pos[0] * 80)},${Math.round(pt.pos[1] * 80)}`
            if (!posGroups4[key]) posGroups4[key] = []
            posGroups4[key].push(i)
        })
        validItineraryPoints.forEach((pt, index) => {
            const key = `${Math.round(pt.pos[0] * 80)},${Math.round(pt.pos[1] * 80)}`
            const group = posGroups4[key]
            const rank = group.indexOf(index)
            if (group.length > 1) {
                const angle = (rank * (360 / group.length) - 90) * (Math.PI / 180)
                const radius = 0.009
                allPositions.push([
                    pt.pos[0] + Math.sin(angle) * radius,
                    pt.pos[1] + Math.cos(angle) * radius / Math.cos(pt.pos[0] * Math.PI / 180),
                ])
            } else {
                allPositions.push(pt.pos)
            }
        })
        focusZoom = 12;
    }

    // Step 3: Filter REAL packages from Firebase by the user's selected hotel tier(s)
    const hotelDistrictMarkers = useMemo(() => {
        if (currentStep !== 3 || hotelTypes.length === 0 || packages.length === 0) return [];

        // Normalise a starCategory string to match hotelTypes format (e.g. "4 Star" -> "4-star")
        const normalise = (s: string) =>
            s.toLowerCase().replace(/\s+/g, '-').replace('star', 'star').trim();

        // Filter packages whose starCategory matches any selected hotelType
        // Also deduplicate by location key
        const seenLocations = new Set<string>();
        return packages.filter(pkg => {
            const cat = normalise(pkg.starCategory || '');
            return hotelTypes.some(ht => cat.includes(ht.replace('-star', '')) || cat === ht);
        }).filter(pkg => {
            const key = (pkg.destination || pkg.location || '').trim().toLowerCase();
            if (!key || seenLocations.has(key)) return false;
            seenLocations.add(key);
            return true;
        });
    }, [currentStep, packages, hotelTypes]);

    return (
        <div className="w-full h-full rounded-2xl overflow-hidden border border-white/10 shadow-inner relative z-0">
            {isLoading && (
                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs text-white z-[1000] border border-white/20 flex items-center gap-2 shadow-xl">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                    Updating Map...
                </div>
            )}

            {/* Step 3: Hotel Zone Legend Overlay */}
            {currentStep === 3 && hotelTypes.length > 0 && (
                <div className="absolute bottom-3 left-3 z-[1000] bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-gray-100 p-3 pointer-events-none">
                    <div className="text-[9px] text-gray-400 font-black uppercase tracking-widest mb-2">Hotel Zones</div>
                    <div className="flex flex-col gap-1.5">
                        {hotelTypes.includes('5-star') && (
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-amber-400 shadow-sm flex-shrink-0"></div>
                                <span className="text-[11px] font-bold text-amber-700">5★ Luxury Zones</span>
                            </div>
                        )}
                        {hotelTypes.includes('4-star') && (
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-indigo-500 shadow-sm flex-shrink-0"></div>
                                <span className="text-[11px] font-bold text-indigo-700">4★ Premium Zones</span>
                            </div>
                        )}
                        {hotelTypes.includes('3-star') && (
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm flex-shrink-0"></div>
                                <span className="text-[11px] font-bold text-emerald-700">3★ Comfort Zones</span>
                            </div>
                        )}
                    </div>
                    <div className="text-[9px] text-gray-300 font-medium mt-2 pt-2 border-t border-gray-100">Click a zone to see details</div>
                </div>
            )}

            <MapContainer
                center={[20, 0]}
                zoom={2}
                style={{ height: '100%', width: '100%', background: '#e5e7eb' }}
                zoomControl={true}
                attributionControl={false}
                scrollWheelZoom={true}
            >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapBounds positions={allPositions} focusZoom={focusZoom} />

                {flightPath.length > 1 && (
                    <Polyline
                        positions={flightPath}
                        pathOptions={{ color: '#6366f1', weight: 4, dashArray: '10, 10', opacity: 0.8 }}
                    />
                )}

                {userLocation && (
                    <Marker position={userLocation} icon={userLocationIcon}>
                        <Popup className="custom-popup">
                            <div className="font-bold text-gray-900">Your Location</div>
                        </Popup>
                    </Marker>
                )}

                {mainDestPos && (
                    <Marker position={mainDestPos} icon={createNumberedIcon("★", true)}>
                        <Popup className="custom-popup" closeButton={false}>
                            <div className="tooltip-card p-2 text-center">
                                <div className="font-bold text-gray-900">{mainDestination}</div>
                                <div className="text-xs text-gray-600 font-medium mt-1">{mainDestinationSubtitle || "Base Destination"}</div>
                            </div>
                        </Popup>
                    </Marker>
                )}

                {/* Step 2: Show Packages with High-End Radial Distribution */}
                {currentStep === 2 && packages.map((pkg, idx) => {
                    // Support both agent packages (destination, primaryImageUrl) and main packages (location, image)
                    const locKey = pkg.destination || pkg.location
                    const basePos = locKey ? coordinates[locKey] : null
                    if (!basePos) return null

                    const imgUrl = pkg.primaryImageUrl || pkg.image || ''
                    const title = pkg.title || pkg.agentPackageTitle || pkg.name || pkg.destination || ''
                    const starCat = pkg.starCategory || ''
                    const nights = pkg.durationNights || pkg.Duration_Nights || ''
                    const price = pkg.pricePerPerson || pkg.Price_Min_INR || 0

                    // Radial spread so markers don't overlap when same destination
                    const angle = (idx * (360 / Math.max(packages.length, 1))) * (Math.PI / 180)
                    const radius = 0.025
                    const jitterLat = Math.sin(angle) * radius
                    const jitterLng = Math.cos(angle) * radius / Math.cos(basePos[0] * Math.PI / 180)
                    const pos: [number, number] = [basePos[0] + jitterLat, basePos[1] + jitterLng]

                    return (
                        <Marker
                            key={`pkg-${idx}`}
                            position={pos}
                            icon={createPackageIcon(imgUrl)}
                            riseOnHover={true}
                            zIndexOffset={100}
                        >
                            <Popup className="custom-popup" maxWidth={260}>
                                <div className="p-0 overflow-hidden rounded-xl bg-white shadow-2xl" style={{ minWidth: 220 }}>
                                    <div className="relative w-full h-28 overflow-hidden bg-gray-100">
                                        {imgUrl
                                            ? <img src={imgUrl} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                                            : <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">🏔️</div>
                                        }
                                        {starCat && starCat.toLowerCase() !== 'none' && (
                                            <div className="absolute top-2 right-2 bg-primary/90 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow">
                                                {starCat}
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-3">
                                        <h4 className="font-bold text-gray-900 text-sm leading-tight line-clamp-2 mb-2">{title}</h4>
                                        <div className="flex items-center justify-between">
                                            {nights ? (
                                                <span className="text-[11px] text-gray-500 font-semibold">🌙 {nights} nights</span>
                                            ) : (
                                                <span className="text-[11px] text-gray-400">{locKey}</span>
                                            )}
                                            {price > 0 && (
                                                <span className="text-[11px] font-black text-primary">₹{Number(price).toLocaleString('en-IN')}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    )
                })}

                {/* Step 3: Real Packages filtered by Hotel Tier */}
                {currentStep === 3 && hotelDistrictMarkers.map((pkg: any, idx: number) => {
                    const locKey = pkg.destination || pkg.location
                    const basePos = locKey ? coordinates[locKey] : null
                    if (!basePos) return null;

                    // Radial spread so markers at the same base location don't overlap
                    const angle = (idx * (360 / Math.max(hotelDistrictMarkers.length, 1))) * (Math.PI / 180);
                    const radius = 0.022;
                    const jLat = Math.sin(angle) * radius;
                    const jLng = Math.cos(angle) * radius / Math.cos(basePos[0] * Math.PI / 180);
                    const pos: [number, number] = [basePos[0] + jLat, basePos[1] + jLng];

                    const tier = (pkg.starCategory || '').toLowerCase().replace(/\s+/g, '-');
                    const tierColor = tier.includes('5') ? '#f59e0b' : tier.includes('4') ? '#6366f1' : '#10b981';
                    const tierLabel = tier.includes('5') ? '5★ Luxury' : tier.includes('4') ? '4★ Premium' : '3★ Comfort';

                    return (
                        <Marker
                            key={`hotel-real-${idx}`}
                            position={pos}
                            icon={createRealHotelIcon(pkg.primaryImageUrl || pkg.image || '', tier)}
                            riseOnHover={true}
                            zIndexOffset={200}
                        >
                            <Popup className="custom-popup" maxWidth={280}>
                                <div className="p-0 overflow-hidden rounded-xl bg-white shadow-2xl">
                                    {/* Package image header */}
                                    <div className="relative w-full h-32 overflow-hidden bg-gray-100">
                                        <img
                                            src={pkg.primaryImageUrl || pkg.image || ''}
                                            className="w-full h-full object-cover"
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                        />
                                        {/* Star tier badge */}
                                        <div className="absolute top-2 right-2 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-lg border border-white/30" style={{ background: tierColor }}>
                                            {tierLabel}
                                        </div>
                                    </div>
                                    <div className="p-3.5">
                                        {/* Package name */}
                                        <h4 className="font-black text-gray-900 text-sm leading-tight mb-1">
                                            {pkg.title || pkg.packageTitle || pkg.name || pkg.destination}
                                        </h4>
                                        {/* Location */}
                                        <div className="flex items-center gap-1.5 text-gray-400 mb-3">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                                            <span className="text-[11px] font-semibold">{pkg.destination || pkg.location}</span>
                                        </div>
                                        {/* Duration if available */}
                                        {pkg.duration && (
                                            <div className="flex items-center gap-1.5 text-gray-400 mb-3">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                                <span className="text-[11px] font-semibold">{pkg.duration}</span>
                                            </div>
                                        )}
                                        <div className="pt-3 border-t border-gray-50 flex items-center justify-between">
                                            <div className="flex items-center gap-1">
                                                {[1,2,3,4,5].map(s => (
                                                    <svg key={s} xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill={tierColor} stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                                                ))}
                                            </div>
                                            <button className="text-[11px] font-black" style={{ color: tierColor }}>VIEW DEAL →</button>
                                        </div>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}

                {/* Itinerary Points (Standard view) — spread duplicates radially so all days are visible */}
                {currentStep !== 2 && currentStep !== 3 && (() => {
                    // Group indices by rounded position key so we can spread stacked markers
                    const posGroups: Record<string, number[]> = {}
                    validItineraryPoints.forEach((item, i) => {
                        const key = `${Math.round(item.pos[0] * 80)},${Math.round(item.pos[1] * 80)}`
                        if (!posGroups[key]) posGroups[key] = []
                        posGroups[key].push(i)
                    })

                    return validItineraryPoints.map((item, index) => {
                        const key = `${Math.round(item.pos[0] * 80)},${Math.round(item.pos[1] * 80)}`
                        const group = posGroups[key]
                        const rank = group.indexOf(index)

                        // Spread duplicate markers in a circle (~800m radius)
                        let pos: [number, number] = item.pos
                        if (group.length > 1) {
                            const angle = (rank * (360 / group.length) - 90) * (Math.PI / 180)
                            const radius = 0.009
                            pos = [
                                item.pos[0] + Math.sin(angle) * radius,
                                item.pos[1] + Math.cos(angle) * radius / Math.cos(item.pos[0] * Math.PI / 180),
                            ]
                        }

                        const dayNum = item.day ? String(item.day).replace(/[^0-9]/g, '') || `${index + 1}` : `${index + 1}`
                        return (
                            <Marker key={`itinerary-${index}`} position={pos} icon={createNumberedIcon(dayNum)}>
                                <Popup className="custom-popup" closeButton={false}>
                                    <div className="tooltip-card p-2 text-center">
                                        <div className="font-bold text-gray-900">{item.title}</div>
                                        {item.day && <div className="text-xs text-primary font-bold mt-2">{item.day}</div>}
                                    </div>
                                </Popup>
                            </Marker>
                        )
                    })
                })()}

                {flightPath.length > 1 && <AirplaneMarker routePath={flightPath as [number, number][]} />}

                {/* Results page (step 4): premium double-stroke road + animated car */}
                {currentStep === 4 && carRoute.length >= 1 && (
                    <>
                        {/* Soft glow underlay */}
                        <Polyline
                            positions={carRoute}
                            pathOptions={{ color: '#ff8a3d', weight: 10, opacity: 0.15, lineCap: 'round', lineJoin: 'round' }}
                        />
                        {/* Dashed centre line */}
                        <Polyline
                            positions={carRoute}
                            pathOptions={{ color: '#ff8a3d', weight: 2.5, opacity: 0.85, dashArray: '8, 6', lineCap: 'round', lineJoin: 'round' }}
                        />
                    </>
                )}
                {currentStep === 4 && carRoute.length >= 1 && (
                    <CarMarker routePath={carRoute} />
                )}
            </MapContainer>
        </div>
    )
}

