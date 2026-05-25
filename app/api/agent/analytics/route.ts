export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')

    if (!agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 })
    }

    // Fetch all bookings for this agent
    const bookingsSnap = await getDocs(
      query(collection(db, 'agent_bookings'), where('agentId', '==', agentId))
    )
    const bookings = bookingsSnap.docs.map(d => d.data())

    // Fetch all packages for this agent
    const packagesSnap = await getDocs(
      query(collection(db, 'agent_packages'), where('agentId', '==', agentId))
    )
    const packages = packagesSnap.docs.map(d => d.data())

    // Fetch customers
    const customersSnap = await getDocs(
      query(collection(db, 'agent_customers'), where('agentId', '==', agentId))
    )

    // Compute analytics
    const totalBookings = bookings.length
    const confirmedBookings = bookings.filter(b => b.status === 'confirmed' || b.status === 'completed').length
    const totalRevenue = bookings
      .filter(b => b.bookingValue)
      .reduce((sum, b) => sum + (b.bookingValue || 0), 0)

    const commissionPaid = bookings
      .filter(b => b.commissionAmount)
      .reduce((sum, b) => sum + (b.commissionAmount || 0), 0)

    // Destination frequency
    const destinationCounts: Record<string, number> = {}
    bookings.forEach(b => {
      if (b.destination) {
        destinationCounts[b.destination] = (destinationCounts[b.destination] || 0) + 1
      }
    })
    const topDestinations = Object.entries(destinationCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([destination, count]) => ({ destination, count }))

    // Bookings by status
    const statusCounts: Record<string, number> = {}
    bookings.forEach(b => {
      statusCounts[b.status] = (statusCounts[b.status] || 0) + 1
    })
    const bookingsByStatus = Object.entries(statusCounts).map(([status, count]) => ({ status, count }))

    // Revenue by month (last 6 months)
    const revenueByMonth: Record<string, number> = {}
    bookings.forEach(b => {
      if (b.createdAt && b.bookingValue) {
        const date = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt)
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        revenueByMonth[key] = (revenueByMonth[key] || 0) + (b.bookingValue || 0)
      }
    })
    const revenueByMonthArr = Object.entries(revenueByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, revenue]) => ({ month, revenue }))

    return NextResponse.json({
      success: true,
      analytics: {
        totalBookings,
        confirmedBookings,
        totalRevenue,
        commissionPaid,
        netRevenue: totalRevenue - commissionPaid,
        totalPackages: packages.length,
        activePackages: packages.filter(p => p.isActive).length,
        totalCustomers: customersSnap.size,
        conversionRate: totalBookings > 0
          ? Math.round((confirmedBookings / totalBookings) * 100)
          : 0,
        topDestinations,
        bookingsByStatus,
        revenueByMonth: revenueByMonthArr,
      },
    })
  } catch (error: any) {
    console.error('[Agent Analytics GET] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
