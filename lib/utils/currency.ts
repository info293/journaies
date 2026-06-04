// Standard local currency for each country (ISO 4217)
export const COUNTRY_CURRENCY: Record<string, string> = {
  // South Asia
  India: 'INR', 'Sri Lanka': 'LKR', Nepal: 'NPR', Bhutan: 'BTN',
  Bangladesh: 'BDT', Pakistan: 'PKR', Maldives: 'MVR',
  // Southeast Asia
  Thailand: 'THB', Singapore: 'SGD', Malaysia: 'MYR', Indonesia: 'IDR',
  Bali: 'IDR', Philippines: 'PHP', Vietnam: 'VND', Cambodia: 'KHR',
  Myanmar: 'MMK', Laos: 'LAK', Brunei: 'BND',
  // East Asia
  Japan: 'JPY', 'South Korea': 'KRW', China: 'CNY', 'Hong Kong': 'HKD',
  Taiwan: 'TWD', Macau: 'MOP',
  // Middle East
  UAE: 'AED', 'United Arab Emirates': 'AED', Bahrain: 'BHD', Oman: 'OMR',
  Qatar: 'QAR', 'Saudi Arabia': 'SAR', Kuwait: 'KWD', Jordan: 'JOD',
  Israel: 'ILS', Turkey: 'TRY', Lebanon: 'LBP',
  // Europe
  UK: 'GBP', 'United Kingdom': 'GBP', Switzerland: 'CHF', Norway: 'NOK',
  Sweden: 'SEK', Denmark: 'DKK', Iceland: 'ISK', 'Czech Republic': 'CZK',
  Hungary: 'HUF', Poland: 'PLN', Russia: 'RUB', Georgia: 'GEL',
  // Eurozone
  France: 'EUR', Germany: 'EUR', Italy: 'EUR', Spain: 'EUR', Portugal: 'EUR',
  Greece: 'EUR', Netherlands: 'EUR', Austria: 'EUR', Belgium: 'EUR',
  Finland: 'EUR', Luxembourg: 'EUR', Croatia: 'EUR', Malta: 'EUR',
  // Americas
  USA: 'USD', 'United States': 'USD', Canada: 'CAD', Mexico: 'MXN',
  Brazil: 'BRL', Argentina: 'ARS', Peru: 'PEN', Colombia: 'COP',
  // Oceania
  Australia: 'AUD', 'New Zealand': 'NZD', Fiji: 'FJD',
  // Africa
  'South Africa': 'ZAR', Kenya: 'KES', Tanzania: 'TZS', Morocco: 'MAD',
  Egypt: 'EGP', Ethiopia: 'ETB', Mauritius: 'MUR', Seychelles: 'SCR',
  Rwanda: 'RWF', Ghana: 'GHS', Nigeria: 'NGN', Zimbabwe: 'USD',
  // Central Asia
  Kazakhstan: 'KZT', Uzbekistan: 'UZS', Azerbaijan: 'AZN', Armenia: 'AMD',
}

export function getCurrencyForCountry(country: string): string {
  return COUNTRY_CURRENCY[country] ?? 'USD'
}

export const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AED', symbol: 'AED ', name: 'UAE Dirham' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht' },
  { code: 'MYR', symbol: 'RM ', name: 'Malaysian Ringgit' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
  { code: 'CHF', symbol: 'CHF ', name: 'Swiss Franc' },
  { code: 'BHD', symbol: 'BD ', name: 'Bahraini Dinar' },
  { code: 'OMR', symbol: 'OMR ', name: 'Omani Rial' },
  { code: 'QAR', symbol: 'QR ', name: 'Qatari Riyal' },
  { code: 'SAR', symbol: 'SR ', name: 'Saudi Riyal' },
  { code: 'KWD', symbol: 'KD ', name: 'Kuwaiti Dinar' },
  { code: 'IDR', symbol: 'Rp ', name: 'Indonesian Rupiah' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong' },
  { code: 'ZAR', symbol: 'R ', name: 'South African Rand' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
]

const SYMBOL_MAP: Record<string, string> = Object.fromEntries(
  CURRENCIES.map(c => [c.code, c.symbol])
)

export function getCurrencySymbol(code?: string): string {
  if (!code) return '₹'
  return SYMBOL_MAP[code] ?? code + ' '
}

export function formatCurrency(amount: number, code?: string): string {
  const symbol = getCurrencySymbol(code)
  return `${symbol}${amount.toLocaleString()}`
}
