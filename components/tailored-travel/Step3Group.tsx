'use client'

const GROUP_OPTIONS = [
    { id: 'couple', label: 'Partner/Couple', icon: '💑', description: 'Romantic getaway for two' },
]

const HOTEL_OPTIONS = [
    { id: '3-star', label: '3-Star', desc: 'Comfortable & Budget-Friendly', icon: '⭐⭐⭐' },
    { id: '4-star', label: '4-Star', desc: 'Premium Amenities', icon: '⭐⭐⭐⭐' },
    { id: '5-star', label: '5-Star', desc: 'Ultimate Luxury', icon: '⭐⭐⭐⭐⭐' },
]

export default function Step3Group({
    data,
    updateData,
    onNext,
    onPrev,
    isSubmitting
}: {
    data: any,
    updateData: (data: any) => void,
    onNext: () => void,
    onPrev: () => void,
    isSubmitting?: boolean
}) {

    const toggleHotel = (id: string) => {
        const current = new Set(data.hotelTypes)
        if (current.has(id)) {
            current.delete(id)
        } else {
            current.add(id)
        }
        updateData({ hotelTypes: Array.from(current) })
    }

    const handleGroupSelection = (id: string) => {
        const newPassengers = { ...data.passengers }
        if (id === 'solo') {
            newPassengers.adults = 1
            newPassengers.rooms = 1
        } else if (id === 'couple') {
            newPassengers.adults = 2
            newPassengers.rooms = 1
        }

        updateData({
            groupType: id,
            passengers: newPassengers
        })
    }

    return (
        <div className="animate-fade-in-up">
            <div className="text-center mb-4 sm:mb-6">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2 tracking-tight drop-shadow-sm">
                    Who's going on this trip?
                </h2>
                <p className="text-sm sm:text-base text-gray-700 font-medium">Select your travel group and what you need included.</p>
            </div>

            <div className="max-w-4xl mx-auto space-y-6">
                {/* Group Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {GROUP_OPTIONS.map((group) => {
                        const isSelected = data.groupType === group.id
                        return (
                            <button
                                key={group.id}
                                onClick={() => handleGroupSelection(group.id)}
                                className={`group flex flex-col items-center justify-center p-4 sm:p-5 md:p-6 rounded-[1.25rem] sm:rounded-[1.5rem] border-2 transition-all duration-300 relative overflow-hidden backdrop-blur-xl ${isSelected
                                    ? 'bg-gradient-to-br from-primary/10 to-[#ff8a3d]/10 border-primary shadow-[0_8px_30px_rgba(0,0,0,0.08)] scale-[1.02] z-10'
                                    : 'bg-white/70 border-gray-100 hover:bg-white hover:border-gray-200 hover:shadow-lg shadow-sm'
                                    }`}
                            >
                                <div className={`text-4xl mb-3 transition-transform duration-500 ease-out ${isSelected ? 'scale-110 drop-shadow-md' : 'grayscale opacity-60 group-hover:scale-110 group-hover:grayscale-0 group-hover:opacity-100'}`}>
                                    {group.icon}
                                </div>
                                <h3 className={`font-black text-lg md:text-xl mb-1.5 transition-colors tracking-tight ${isSelected ? 'text-gray-900' : 'text-gray-600 group-hover:text-gray-900'}`}>
                                    {group.label}
                                </h3>
                                <p className={`text-xs font-medium transition-colors ${isSelected ? 'text-primary' : 'text-gray-500'}`}>{group.description}</p>

                                {/* Selection Indicator */}
                                <div className={`absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'border-primary bg-primary text-white scale-100 opacity-100' : 'border-gray-300 scale-75 opacity-0 group-hover:opacity-50'}`}>
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                </div>
                            </button>
                        )
                    })}
                </div>

                {/* Hotel Category */}
                <div className="bg-white/70 backdrop-blur-2xl rounded-[1.25rem] sm:rounded-[1.5rem] p-4 sm:p-6 md:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-100">
                    <label className="block text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-widest mb-3 sm:mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-[#ff8a3d]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1v1H9V7zm5 0h1v1h-1V7zm-5 4h1v1H9v-1zm5 0h1v1h-1v-1zm-5 4h1v1H9v-1zm5 0h1v1h-1v-1z" /></svg>
                        Select Hotel Category
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                        {HOTEL_OPTIONS.map((item) => {
                            const isSelected = data.hotelTypes.includes(item.id)
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => toggleHotel(item.id)}
                                    className={`relative overflow-hidden flex flex-col items-center justify-center text-center gap-1 sm:gap-1.5 p-4 sm:p-5 rounded-[1rem] sm:rounded-[1.25rem] border-2 transition-all duration-300 group ${isSelected
                                        ? 'bg-gradient-to-br from-primary/10 to-[#ff8a3d]/10 border-primary shadow-[0_8px_30px_rgba(0,0,0,0.08)] scale-[1.02]'
                                        : 'bg-white/70 border-gray-100 hover:bg-white hover:border-gray-200 hover:shadow-lg shadow-sm'
                                        }`}
                                >
                                    <span className={`text-2xl tracking-widest transition-transform duration-500 ${isSelected ? 'scale-110 drop-shadow-md' : 'grayscale opacity-60 group-hover:scale-110 group-hover:grayscale-0 group-hover:opacity-100'}`}>{item.icon}</span>
                                    <span className={`font-black mt-2 text-lg tracking-tight transition-colors ${isSelected ? 'text-gray-900' : 'text-gray-600 group-hover:text-gray-900'}`}>{item.label}</span>
                                    <span className={`text-xs font-medium transition-colors ${isSelected ? 'text-primary' : 'text-gray-500'}`}>{item.desc}</span>

                                    {/* Selection Indicator */}
                                    <div className={`absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'border-primary bg-primary text-white scale-100 opacity-100' : 'border-gray-300 scale-75 opacity-0 group-hover:opacity-50'}`}>
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>

            </div>

            <div className="mt-8 flex flex-col-reverse sm:flex-row justify-center items-center gap-3 sm:gap-4 w-full">
                <button
                    onClick={onPrev}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto px-8 py-3 sm:py-3.5 bg-white/70 backdrop-blur-md text-gray-700 border-2 border-gray-100/50 rounded-full font-medium text-sm sm:text-base hover:bg-white hover:border-gray-200 transition-all shadow-sm disabled:opacity-50 text-center flex justify-center items-center whitespace-nowrap"
                >
                    ← Back
                </button>
                <button
                    onClick={onNext}
                    disabled={isSubmitting || !data.groupType || data.hotelTypes.length === 0}
                    className="w-full sm:w-auto px-10 py-3 sm:py-3.5 bg-gray-900 text-white rounded-full font-medium text-sm sm:text-base shadow-xl hover:shadow-2xl hover:bg-gray-800 hover:scale-105 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:hover:scale-100 disabled:shadow-none whitespace-nowrap"
                >
                    {isSubmitting ? (
                        <>
                            <svg className="animate-spin -ml-1 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Creating Itinerary...
                        </>
                    ) : (
                        'Generate Itinerary ✨'
                    )}
                </button>
            </div>

        </div>
    )
}
