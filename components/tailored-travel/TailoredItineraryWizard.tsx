'use client'

import { useState } from 'react'
import Step1Destinations from './Step1Destinations'
import Step2Nights from './Step2Nights'
import Step3Group from './Step3Group'
import StepDmc1Destination from './StepDmc1Destination'
import StepDmc2Cities from './StepDmc2Cities'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import WizardSidePanel from './WizardSidePanel'

interface TailoredItineraryWizardProps {
    agentSlug?: string
    subAgentId?: string
    sessionId?: string
    isEmbed?: boolean
}

// DMC mode: 2 steps. Main mode: 3 steps.
const DMC_STEPS = ['Your Journey', 'Package Details']
const MAIN_STEPS = ['Start', 'Route', 'Group & Stay']

export default function TailoredItineraryWizard({ agentSlug, subAgentId, sessionId, isEmbed }: TailoredItineraryWizardProps = {}) {
    const [currentStep, setCurrentStep] = useState(1)
    const [direction, setDirection] = useState(0)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const router = useRouter()

    const isDmcMode = !!agentSlug

    const [wizardData, setWizardData] = useState({
        destinations: [] as string[],
        dateRange: 'Flexible',
        experiences: [] as string[],
        routeItems: [] as any[],
        groupType: 'couple',
        inclusions: ['hotels', 'flights'] as string[],
        hotelIncluded: null as boolean | null,
        hotelTypes: [] as string[],
        groupSize: { adults: 2, children: 0, infants: 0 },
        passengers: { adults: 2, kids: 0, rooms: 1 },
        userOrigin: null as [number, number] | null,
        destinationPackages: [] as any[],
        // DMC-specific fields
        includedCities: [] as string[],
        availableCities: [] as string[],
        availableNights: [] as { nights: number; label: string }[],
        pickupCity: '',
        dropCity: '',
    })

    useState(() => {
        if (typeof window !== 'undefined' && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setWizardData(prev => ({
                        ...prev,
                        userOrigin: [position.coords.latitude, position.coords.longitude]
                    }))
                },
                () => { /* geolocation ignored */ }
            )
        }
    })

    const updateData = (newData: Partial<typeof wizardData>) => {
        setWizardData(prev => ({ ...prev, ...newData }))
    }

    const handleNext = () => {
        setDirection(1)
        setCurrentStep(prev => prev + 1)
    }

    const handlePrev = () => {
        setDirection(-1)
        setCurrentStep(prev => prev - 1)
    }

    const handleGenerateItinerary = () => {
        setIsSubmitting(true)

        if (typeof window !== 'undefined') {
            const dataToSave: Record<string, any> = { ...wizardData }
            if (agentSlug) dataToSave.agentSlug = agentSlug
            if (subAgentId) dataToSave.subAgentId = subAgentId
            if (sessionId) dataToSave.sessionId = sessionId
            sessionStorage.setItem('tailored_wizard_data', JSON.stringify(dataToSave))
        }

        if (agentSlug && sessionId) {
            fetch('/api/agent/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentSlug,
                    sessionId,
                    action: 'itinerary_generated',
                    subAgentId,
                    destination: wizardData.destinations[0] || undefined,
                }),
            }).catch(() => {})
        }

        const embedSuffix = isEmbed ? '?embed=1' : ''
        const resultsPath = agentSlug
            ? `/tailored-travel/${agentSlug}/results${embedSuffix}`
            : `/tailored-travel/results${embedSuffix}`
        router.push(resultsPath)
    }

    const stepLabels = isDmcMode ? DMC_STEPS : MAIN_STEPS
    const totalSteps = stepLabels.length
    const progressPercent = ((currentStep - 1) / (totalSteps - 1)) * 100

    return (
        <div className="w-full max-w-[90rem] mx-auto py-2 md:py-4 px-2 sm:px-4 md:px-8 flex-1 flex flex-col">
            <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 lg:gap-8 flex-1 w-full relative z-10 transition-all duration-500 min-h-[400px] lg:min-h-[500px]">

                {/* LEFT COLUMN: WIZARD FORM */}
                <div className="w-full lg:w-[55%] flex flex-col relative z-20">
                    <div className="bg-white/90 sm:bg-white/80 backdrop-blur-3xl border border-gray-200/50 shadow-2xl shadow-gray-200/50 rounded-3xl sm:rounded-[2.5rem] p-4 sm:p-5 lg:p-6 text-gray-900 flex-1 flex flex-col relative overflow-hidden">

                        {/* Progress Bar */}
                        <div className="mb-5 sm:mb-7 max-w-3xl mx-auto w-full px-2 sm:px-4 md:px-0 mt-1 sm:mt-3 relative z-10">
                            <div className="flex justify-between text-[10px] sm:text-xs font-medium text-gray-400 mb-2 sm:mb-3 uppercase tracking-wider relative z-10">
                                {stepLabels.map((label, idx) => (
                                    <span
                                        key={label}
                                        className={`transition-colors truncate ${
                                            idx === stepLabels.length - 1 ? 'text-right' : idx > 0 ? 'text-center' : ''
                                        } ${currentStep >= idx + 1 ? 'text-gray-900 drop-shadow-sm' : ''}`}
                                    >
                                        {label}
                                    </span>
                                ))}
                            </div>
                            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden relative shadow-inner">
                                <div
                                    className="absolute top-0 left-0 h-full bg-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)] transition-all duration-700 ease-out"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="max-w-3xl mx-auto mb-6 p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 text-center font-medium">
                                {error}
                            </div>
                        )}

                        {/* Step Rendering */}
                        <div className="px-1 sm:px-2 relative overflow-hidden min-h-[300px] sm:min-h-[420px]">
                            <AnimatePresence mode="wait" custom={direction} initial={false}>
                                <motion.div
                                    key={currentStep}
                                    custom={direction}
                                    variants={{
                                        enter: (dir: number) => ({ x: dir > 0 ? 800 : -800, opacity: 0 }),
                                        center: { zIndex: 1, x: 0, opacity: 1 },
                                        exit: (dir: number) => ({ zIndex: 0, x: dir < 0 ? 800 : -800, opacity: 0 }),
                                    }}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                    transition={{
                                        x: { type: 'spring', stiffness: 300, damping: 30 },
                                        opacity: { duration: 0.2 },
                                    }}
                                    className="w-full"
                                >
                                    {/* ── DMC MODE: 2 steps ── */}
                                    {isDmcMode && currentStep === 1 && (
                                        <StepDmc1Destination
                                            data={wizardData}
                                            updateData={updateData}
                                            onNext={handleNext}
                                            agentSlug={agentSlug!}
                                        />
                                    )}
                                    {isDmcMode && currentStep === 2 && (
                                        <StepDmc2Cities
                                            data={wizardData}
                                            updateData={updateData}
                                            onNext={handleGenerateItinerary}
                                            onPrev={handlePrev}
                                            isSubmitting={isSubmitting}
                                        />
                                    )}

                                    {/* ── MAIN SITE: 3 steps ── */}
                                    {!isDmcMode && currentStep === 1 && (
                                        <Step1Destinations
                                            data={wizardData}
                                            updateData={updateData}
                                            onNext={handleNext}
                                            agentSlug={agentSlug}
                                        />
                                    )}
                                    {!isDmcMode && currentStep === 2 && (
                                        <Step2Nights
                                            data={wizardData}
                                            updateData={updateData}
                                            onNext={handleNext}
                                            onPrev={handlePrev}
                                            agentSlug={agentSlug}
                                        />
                                    )}
                                    {!isDmcMode && currentStep === 3 && (
                                        <Step3Group
                                            data={wizardData}
                                            updateData={updateData}
                                            onNext={handleGenerateItinerary}
                                            onPrev={handlePrev}
                                            isSubmitting={isSubmitting}
                                        />
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: MAP & SUMMARY */}
                <WizardSidePanel currentStep={currentStep} data={wizardData} />

            </div>
        </div>
    )
}
