// Agent Platform Types

export type AgentStatus = 'pending' | 'active' | 'suspended' | 'rejected'
export type AgencyType = 'individual' | 'small_agency' | 'large_agency' | 'franchise'
export type SubscriptionPlan = 'basic' | 'pro'

export interface Agent {
  id: string
  // Auth
  uid: string         // Firebase Auth UID
  email: string
  // Profile
  agentSlug: string   // e.g. "ravindra" → URL: /tailored-travel/ravindra
  companyName: string
  contactName: string
  phone: string
  gstNumber: string
  agencyType: AgencyType
  logoUrl?: string
  // Platform
  status: AgentStatus
  subscriptionPlan: SubscriptionPlan
  commissionRate: number  // percentage, e.g. 10 = 10%
  fallbackToTravelzada: boolean  // allow fallback to main packages if no agent match
  // Stats (denormalized for fast reads)
  totalPackages: number
  totalBookings: number
  totalRevenue: number
  // Timestamps
  createdAt: any
  updatedAt: any
  approvedAt?: any
  approvedBy?: string
  rejectionReason?: string
  adminNotes?: string
  baseCurrency?: string  // e.g. 'INR', 'USD', 'EUR' — DMC's default display currency
}

export interface HotelEntry {
  id: string
  destination: string
  nights: number
  hotels: string      // hotel name(s) — can be multiple options separated by /
  mealPlan: string    // Breakfast | Half Board | Full Board | All Inclusive | Room Only
  roomType: string
}

export interface VehicleEntry {
  id: string
  vehicleType: string  // e.g. Sedan, SUV, Innova Crysta, Tempo Traveller, Bus
  seats: number
  route: string        // e.g. "Airport transfers", "All sightseeing"
  days: number
  notes: string        // e.g. "AC vehicle with driver"
}

export interface AgentPackage {
  id: string
  agentId: string
  agentSlug: string
  // Package Details (mirrors main packages collection)
  title: string
  destination: string
  destinationCountry?: string
  overview: string
  durationDays: number
  durationNights: number
  pricePerPerson: number       // price in original currency
  totalPrice?: number | null   // optional fixed total price for the whole group
  gst?: number | null          // GST percentage, e.g. 5 = 5%
  currency?: string            // e.g. 'INR', 'USD', 'EUR', 'AED'
  priceInINR?: number          // converted price in INR (stored for consistency)
  maxGroupSize: number
  minGroupSize?: number
  adults?: number
  children?: number
  infants?: number
  travelType: string     // e.g. "Leisure", "Adventure", "Honeymoon"
  theme: string          // e.g. "Beach", "Wildlife", "Cultural"
  mood: string           // e.g. "Relaxing", "Adventurous"
  starCategory: string   // e.g. "3-Star", "4-Star", "5-Star"
  inclusions: string[]
  exclusions: string[]
  highlights: string[]
  dayWiseItinerary: string
  hotels?: HotelEntry[]
  vehicles?: VehicleEntry[]
  perks?: string[]
  primaryImageUrl?: string
  imageUrls?: string[]
  // Availability
  seasonalAvailability?: string  // e.g. "Oct-Mar", "Year Round"
  isActive: boolean
  // Agent custom markup
  basePackageId?: string  // if based on a Travelzada base package
  markupPercent?: number  // markup on top of base price
  // Timestamps
  createdAt: any
  updatedAt: any
}

export interface AgentBooking {
  id: string
  agentId: string
  agentSlug: string
  packageId: string
  packageTitle: string
  destination: string
  // Customer Info
  customerName: string
  customerEmail: string
  customerPhone: string
  // Trip Details
  preferredDates: string
  groupSize: number
  adults: number
  kids: number
  rooms: number
  specialRequests?: string
  // Itinerary snapshot
  wizardData?: any
  selectedPackage?: any
  chatMessages?: any[]
  // Status
  status: 'new' | 'contacted' | 'confirmed' | 'cancelled' | 'completed'
  bookingValue?: number
  commissionAmount?: number
  adminNotes?: string
  agentNotes?: string
  // Timestamps
  createdAt: any
  updatedAt: any
}

export interface AgentCustomer {
  id: string
  agentId: string
  name: string
  email: string
  phone?: string
  totalTrips: number
  totalSpend: number
  lastTripDate?: any
  preferences?: {
    destinations: string[]
    travelType: string[]
    hotelStars: string[]
  }
  notes?: string
  createdAt: any
  updatedAt: any
}

export interface AgentAnalytics {
  totalVisits: number
  itinerariesGenerated: number
  bookingsSubmitted: number
  conversionRate: number
  topDestinations: { destination: string; count: number }[]
  revenueByMonth: { month: string; revenue: number }[]
  bookingsByStatus: { status: string; count: number }[]
}

export interface SubAgent {
  id: string           // Firebase Auth UID
  agentId: string      // parent agent UID
  agentSlug: string    // parent agent slug
  name: string
  email: string
  phone?: string
  logoUrl?: string
  isActive: boolean
  totalBookings: number
  totalRevenue: number
  lastActiveAt?: any
  createdAt: any
  createdBy: string    // parent agent UID
}

export interface AgentSession {
  id: string
  agentSlug: string
  subAgentId?: string
  subAgentName?: string
  sessionId: string
  action: 'visit' | 'itinerary_generated' | 'booking_submitted'
  destination?: string
  packageTitle?: string
  timestamp: any
  metadata?: any
}
