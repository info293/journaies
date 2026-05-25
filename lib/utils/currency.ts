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
