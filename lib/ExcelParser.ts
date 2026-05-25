import * as XLSX from 'xlsx';

export interface DestinationMasterRow {
    Destination_Code: string;
    Destination_Name: string;
    Country?: string;
    Region?: string;
}

export interface PackagesMasterRow {
    Destination_ID: string;
    Destination_Name?: string;
    Price_Range_INR: string;
    Duration?: string;
    Travel_Type?: string;
    Mood?: string;
    Occasion?: string;
    Budget_Category?: string;
    Theme?: string;
    Adventure_Level?: string;
    Stay_Type?: string;
    Star_Category?: string;
    Meal_Plan?: string;
    Group_Size?: string;
    Child_Friendly?: string;
    Elderly_Friendly?: string;
    Language_Preference?: string;
    Seasonality?: string;
    Hotel_Examples?: string;
    Rating?: string;
    Location_Breakup?: string;
    Airport_Code?: string;
    Transfer_Type?: string;
    Currency?: string;
    Climate_Type?: string;
    Safety_Score?: string;
    Sustainability_Score?: string;
    Ideal_Traveler_Persona?: string;
    Primary_Image_URL?: string;
    Image_Alt_Text?: string;
    Inclusions?: string;
    Exclusions?: string;
    Day_Wise_Itinerary?: string;
    Slug?: string;
}

export interface DaywiseItineraryRow {
    Destination_ID: string;
    Day: number | string;
    Title?: string;
    Description: string;
}

export interface InclusionsExclusionsRow {
    Destination_ID: string;
    Inclusions?: string;
    Exclusions?: string;
    Highlights?: string;
}

export interface GuestReviewRow {
    Destination_ID: string;
    Name: string;
    Content: string;
    Date: string;
    Rating?: string;
}

export interface BookingPolicyRow {
    Destination_ID: string;
    Policy_Type: string; // 'booking', 'payment', 'cancellation'
    Item: string;
}

export interface FAQRow {
    Destination_ID: string;
    Question: string;
    Answer: string;
}

export interface WhyBookRow {
    Destination_ID: string;
    Label: string;
    Description: string;
}

export interface ParsedExcelData {
    destinations: DestinationMasterRow[];
    packages: PackagesMasterRow[];
    itinerary: DaywiseItineraryRow[];
    inclusionsExclusions: InclusionsExclusionsRow[];
    guestReviews: GuestReviewRow[];
    bookingPolicies: BookingPolicyRow[];
    faqs: FAQRow[];
    whyBookWithUs: WhyBookRow[];
}

/**
 * Parse an Excel file (ArrayBuffer) and extract data from expected sheets.
 * Expected sheets: Destination_Master, Packages_Master, Daywise_Itinerary, Inclusions_Exclusions,
 *                  Guest_Reviews, Booking_Policies, FAQ_Items, Why_Book_With_Us
 */
export function parseExcelFile(fileBuffer: ArrayBuffer): ParsedExcelData {
    const workbook = XLSX.read(fileBuffer, { type: 'array' });

    const sheetNames = workbook.SheetNames;

    // Find sheets by name (case-insensitive partial match)
    const findSheet = (searchTerms: string[]): XLSX.WorkSheet | null => {
        for (const term of searchTerms) {
            const found = sheetNames.find(
                (name) => name.toLowerCase().includes(term.toLowerCase())
            );
            if (found) {
                return workbook.Sheets[found];
            }
        }
        return null;
    };

    // Parse each sheet
    const destinationSheet = findSheet(['destination_master', 'destinations', 'destination']);
    const packagesSheet = findSheet(['packages_master', 'packages', 'package']);
    const itinerarySheet = findSheet(['daywise_itinerary', 'daywise', 'itinerary']);
    const incExcSheet = findSheet(['inclusions_exclusions', 'inclusions', 'inc_exc']);

    // New Sheets
    const reviewsSheet = findSheet(['guest_reviews', 'reviews']);
    const policiesSheet = findSheet(['booking_policies', 'policies']);
    const faqSheet = findSheet(['faq_items', 'faqs', 'faq']);
    const whyBookSheet = findSheet(['why_book_with_us', 'why_book']);

    const destinations: DestinationMasterRow[] = destinationSheet
        ? XLSX.utils.sheet_to_json<DestinationMasterRow>(destinationSheet)
        : [];

    const packages: PackagesMasterRow[] = packagesSheet
        ? XLSX.utils.sheet_to_json<PackagesMasterRow>(packagesSheet)
        : [];

    const itinerary: DaywiseItineraryRow[] = itinerarySheet
        ? XLSX.utils.sheet_to_json<DaywiseItineraryRow>(itinerarySheet)
        : [];

    const inclusionsExclusions: InclusionsExclusionsRow[] = incExcSheet
        ? XLSX.utils.sheet_to_json<InclusionsExclusionsRow>(incExcSheet)
        : [];

    const guestReviews: GuestReviewRow[] = reviewsSheet
        ? XLSX.utils.sheet_to_json<GuestReviewRow>(reviewsSheet).map(row => ({
            ...row,
            Date: typeof row.Date === 'number' ? excelDateToJSDate(row.Date) : row.Date
        }))
        : [];

    const bookingPolicies: BookingPolicyRow[] = policiesSheet
        ? XLSX.utils.sheet_to_json<BookingPolicyRow>(policiesSheet)
        : [];

    const faqs: FAQRow[] = faqSheet
        ? XLSX.utils.sheet_to_json<FAQRow>(faqSheet)
        : [];

    const whyBookWithUs: WhyBookRow[] = whyBookSheet
        ? XLSX.utils.sheet_to_json<WhyBookRow>(whyBookSheet)
        : [];

    return {
        destinations,
        packages,
        itinerary,
        inclusionsExclusions,
        guestReviews,
        bookingPolicies,
        faqs,
        whyBookWithUs
    };
}

/**
 * Get list of sheet names from an Excel file
 */
export function getSheetNames(fileBuffer: ArrayBuffer): string[] {
    const workbook = XLSX.read(fileBuffer, { type: 'array' });
    return workbook.SheetNames;
}

/**
 * Parse a specific sheet from an Excel file
 */
export function parseSheet<T>(fileBuffer: ArrayBuffer, sheetName: string): T[] {
    const workbook = XLSX.read(fileBuffer, { type: 'array' });
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
        return [];
    }
    return XLSX.utils.sheet_to_json<T>(sheet);
}

/**
 * Convert Excel serial date to JS Date string (DD Month YYYY)
 * @param serial Serial number from Excel (e.g., 45992)
 * @returns Formatted date string (e.g., "01 December 2025")
 */
function excelDateToJSDate(serial: number): string {
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);

    // Format options: 01 December 2025
    const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'long', year: 'numeric' };
    return date_info.toLocaleDateString('en-GB', options);
}
