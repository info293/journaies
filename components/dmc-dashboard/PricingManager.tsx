'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/firebase'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { Loader2, RefreshCw, Save, AlertCircle, CheckCircle2, TrendingUp } from 'lucide-react'
import { CURRENCIES, getCurrencyForCountry } from '@/lib/utils/currency'

// Currency metadata for codes not in the shared CURRENCIES list
const EXTRA_CURRENCY_NAMES: Record<string, { symbol: string; name: string }> = {
  LKR: { symbol: 'Rs ', name: 'Sri Lankan Rupee' },
  NPR: { symbol: 'Rs ', name: 'Nepalese Rupee' },
  BTN: { symbol: 'Nu ', name: 'Bhutanese Ngultrum' },
  BDT: { symbol: '৳ ', name: 'Bangladeshi Taka' },
  PKR: { symbol: 'Rs ', name: 'Pakistani Rupee' },
  MVR: { symbol: 'Rf ', name: 'Maldivian Rufiyaa' },
  KHR: { symbol: '៛ ', name: 'Cambodian Riel' },
  MMK: { symbol: 'K ', name: 'Myanmar Kyat' },
  LAK: { symbol: '₭ ', name: 'Lao Kip' },
  BND: { symbol: 'B$ ', name: 'Brunei Dollar' },
  CNY: { symbol: '¥ ', name: 'Chinese Yuan' },
  HKD: { symbol: 'HK$ ', name: 'Hong Kong Dollar' },
  TWD: { symbol: 'NT$ ', name: 'New Taiwan Dollar' },
  MOP: { symbol: 'P ', name: 'Macanese Pataca' },
  JOD: { symbol: 'JD ', name: 'Jordanian Dinar' },
  ILS: { symbol: '₪ ', name: 'Israeli Shekel' },
  EGP: { symbol: 'E£ ', name: 'Egyptian Pound' },
  LBP: { symbol: 'L£ ', name: 'Lebanese Pound' },
  NOK: { symbol: 'kr ', name: 'Norwegian Krone' },
  SEK: { symbol: 'kr ', name: 'Swedish Krona' },
  DKK: { symbol: 'kr ', name: 'Danish Krone' },
  ISK: { symbol: 'kr ', name: 'Icelandic Króna' },
  CZK: { symbol: 'Kč ', name: 'Czech Koruna' },
  HUF: { symbol: 'Ft ', name: 'Hungarian Forint' },
  PLN: { symbol: 'zł ', name: 'Polish Zloty' },
  RUB: { symbol: '₽ ', name: 'Russian Ruble' },
  GEL: { symbol: '₾ ', name: 'Georgian Lari' },
  MXN: { symbol: 'Mex$ ', name: 'Mexican Peso' },
  BRL: { symbol: 'R$ ', name: 'Brazilian Real' },
  ARS: { symbol: 'Arg$ ', name: 'Argentine Peso' },
  PEN: { symbol: 'S/ ', name: 'Peruvian Sol' },
  COP: { symbol: 'Col$ ', name: 'Colombian Peso' },
  FJD: { symbol: 'FJ$ ', name: 'Fijian Dollar' },
  KES: { symbol: 'Ksh ', name: 'Kenyan Shilling' },
  TZS: { symbol: 'TSh ', name: 'Tanzanian Shilling' },
  MAD: { symbol: 'MAD ', name: 'Moroccan Dirham' },
  ETB: { symbol: 'Br ', name: 'Ethiopian Birr' },
  MUR: { symbol: '₨ ', name: 'Mauritian Rupee' },
  SCR: { symbol: '₨ ', name: 'Seychellois Rupee' },
  RWF: { symbol: 'RF ', name: 'Rwandan Franc' },
  GHS: { symbol: '₵ ', name: 'Ghanaian Cedi' },
  NGN: { symbol: '₦ ', name: 'Nigerian Naira' },
  KZT: { symbol: '₸ ', name: 'Kazakhstani Tenge' },
  UZS: { symbol: 'so\'m ', name: 'Uzbekistani Som' },
  AZN: { symbol: '₼ ', name: 'Azerbaijani Manat' },
  AMD: { symbol: '֏ ', name: 'Armenian Dram' },
}

function getCurrencyName(code: string): string {
  const known = CURRENCIES.find(c => c.code === code)
  if (known) return known.name
  return EXTRA_CURRENCY_NAMES[code]?.name ?? code
}

function getCurrencySymbolExtended(code: string): string {
  const known = CURRENCIES.find(c => c.code === code)
  if (known) return known.symbol
  return EXTRA_CURRENCY_NAMES[code]?.symbol ?? `${code} `
}

// Reuse same cache pattern as PackageManager (30-min TTL)
const RATE_CACHE: Record<string, { rate: number; updatedAt: string; cachedAt: number }> = {}
const CACHE_TTL_MS = 30 * 60 * 1000

async function fetchINRRate(fromCurrency: string): Promise<{ rate: number; updatedAt: string }> {
  if (fromCurrency === 'INR') return { rate: 1, updatedAt: '' }
  const cached = RATE_CACHE[fromCurrency]
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return { rate: cached.rate, updatedAt: cached.updatedAt }
  }
  const res = await fetch(`https://open.er-api.com/v6/latest/${fromCurrency}`)
  if (!res.ok) throw new Error(`Rate fetch failed: ${res.status}`)
  const data = await res.json()
  if (data.result !== 'success') throw new Error('Rate API error')
  const rate: number = data.rates['INR'] ?? 1
  const updatedAt: string = data.time_last_update_utc ?? new Date().toUTCString()
  RATE_CACHE[fromCurrency] = { rate, updatedAt, cachedAt: Date.now() }
  return { rate, updatedAt }
}

interface PricingRowData {
  country: string
  currency: string    // derived from COUNTRY_CURRENCY map, not from package
  packageCount: number
}

interface RateState {
  rate: number
  updatedAt: string
  loading: boolean
  error: boolean
}

interface PricingConfig {
  markupPercent: number
  showInINR: boolean
}

interface Props {
  agentId: string
}

export default function PricingManager({ agentId }: Props) {
  const [rows, setRows] = useState<PricingRowData[]>([])
  const [packagesLoading, setPackagesLoading] = useState(true)
  const [rates, setRates] = useState<Record<string, RateState>>({})
  // pricingConfig keyed by `${country}|||${currency}`
  const [config, setConfig] = useState<Record<string, PricingConfig>>({})
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')

  // Load packages and existing config
  useEffect(() => {
    async function load() {
      setPackagesLoading(true)
      try {
        // Fetch packages
        const res = await fetch(`/api/agent/packages?agentId=${agentId}`)
        const data = await res.json()
        const packages: any[] = data.packages ?? []

        // Group by unique country; derive currency from COUNTRY_CURRENCY map
        const seen = new Map<string, PricingRowData>()
        for (const pkg of packages) {
          const country = (pkg.destinationCountry || 'Unknown') as string
          const currency = getCurrencyForCountry(country)
          const key = `${country}|||${currency}`
          if (!seen.has(key)) {
            seen.set(key, { country, currency, packageCount: 0 })
          }
          seen.get(key)!.packageCount++
        }
        const rowList = Array.from(seen.values()).sort((a, b) =>
          a.country.localeCompare(b.country)
        )
        setRows(rowList)

        // Load saved pricing config from agent doc
        const agentSnap = await getDoc(doc(db, 'agents', agentId))
        const savedConfig: Record<string, any> = agentSnap.data()?.pricingConfig ?? {}

        // Merge: ensure every row has an entry
        const merged: Record<string, PricingConfig> = {}
        for (const row of rowList) {
          const key = `${row.country}|||${row.currency}`
          merged[key] = {
            markupPercent: savedConfig[key]?.markupPercent ?? 0,
            showInINR: savedConfig[key]?.showInINR ?? false,
          }
        }
        setConfig(merged)

        // Fetch live exchange rates for unique currencies
        const uniqueCurrencies = [...new Set(rowList.map(r => r.currency))]
        const initial: Record<string, RateState> = {}
        for (const c of uniqueCurrencies) {
          initial[c] = { rate: 1, updatedAt: '', loading: c !== 'INR', error: false }
        }
        setRates(initial)

        for (const c of uniqueCurrencies) {
          if (c === 'INR') continue
          fetchINRRate(c)
            .then(({ rate, updatedAt }) =>
              setRates(prev => ({ ...prev, [c]: { rate, updatedAt, loading: false, error: false } }))
            )
            .catch(() =>
              setRates(prev => ({ ...prev, [c]: { rate: 1, updatedAt: '', loading: false, error: true } }))
            )
        }
      } catch { } finally {
        setPackagesLoading(false)
      }
    }
    load()
  }, [agentId])

  function refreshRate(currency: string) {
    delete RATE_CACHE[currency]
    setRates(prev => ({ ...prev, [currency]: { ...(prev[currency] ?? {}), loading: true, error: false, rate: prev[currency]?.rate ?? 1, updatedAt: '' } }))
    fetchINRRate(currency)
      .then(({ rate, updatedAt }) =>
        setRates(prev => ({ ...prev, [currency]: { rate, updatedAt, loading: false, error: false } }))
      )
      .catch(() =>
        setRates(prev => ({ ...prev, [currency]: { ...prev[currency], loading: false, error: true } }))
      )
  }

  function setMarkup(key: string, value: string) {
    const num = Math.max(0, parseFloat(value) || 0)
    setConfig(prev => ({ ...prev, [key]: { ...prev[key], markupPercent: num } }))
    setSaveStatus('idle')
  }

  function toggleShowInINR(key: string) {
    setConfig(prev => ({ ...prev, [key]: { ...prev[key], showInINR: !prev[key]?.showInINR } }))
    setSaveStatus('idle')
  }

  async function saveConfig() {
    setSaving(true)
    setSaveStatus('idle')
    try {
      await updateDoc(doc(db, 'agents', agentId), { pricingConfig: config })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch {
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }

  function effectiveRate(currency: string, buffer: number) {
    const base = rates[currency]?.rate ?? 1
    return base + buffer
  }

  if (packagesLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium text-gray-500">No packages found</p>
        <p className="text-sm mt-1">Add packages first to configure pricing.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Exchange Rate Buffer</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Set a flat INR buffer added on top of the live exchange rate per destination. Toggle to show package prices in INR or local currency.
          </p>
        </div>
        <button
          onClick={saveConfig}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save Changes
        </button>
      </div>

      {saveStatus === 'saved' && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-100 rounded-xl px-4 py-2.5">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          Pricing configuration saved successfully.
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Failed to save. Please try again.
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Destination</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Currency</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">
                  <span className="flex items-center gap-1.5">
                    Exchange Rate
                    <span className="text-[10px] font-normal text-gray-400 normal-case">(1 unit → INR)</span>
                  </span>
                </th>
                <th className="text-left px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Buffer (₹ INR)</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">
                  <span className="flex items-center gap-1.5">
                    Effective Rate
                    <span className="text-[10px] font-normal text-gray-400 normal-case">(after markup)</span>
                  </span>
                </th>
                <th className="text-center px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Show Price in INR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(row => {
                const key = `${row.country}|||${row.currency}`
                const rateState = rates[row.currency]
                const cfg = config[key] ?? { markupPercent: 0, showInINR: false }
                const isINR = row.currency === 'INR'
                const effRate = effectiveRate(row.currency, cfg.markupPercent)
                const currencyName = getCurrencyName(row.currency)
                const currencySymbol = getCurrencySymbolExtended(row.currency)

                return (
                  <tr key={key} className="hover:bg-gray-50/50 transition-colors">
                    {/* Destination */}
                    <td className="px-5 py-4">
                      <div className="font-medium text-gray-900">{row.country}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{row.packageCount} package{row.packageCount !== 1 ? 's' : ''}</div>
                    </td>

                    {/* Currency */}
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-lg">
                        <span className="text-gray-500">{currencySymbol}</span>
                        {row.currency}
                      </span>
                      <div className="text-xs text-gray-400 mt-1">{currencyName}</div>
                    </td>

                    {/* Live Exchange Rate */}
                    <td className="px-5 py-4">
                      {isINR ? (
                        <span className="text-gray-500 text-xs">Base currency</span>
                      ) : rateState?.loading ? (
                        <span className="flex items-center gap-1.5 text-gray-400 text-xs">
                          <Loader2 className="w-3 h-3 animate-spin" />Fetching…
                        </span>
                      ) : rateState?.error ? (
                        <span className="flex items-center gap-1.5 text-red-500 text-xs">
                          <AlertCircle className="w-3 h-3" />Failed
                          <button onClick={() => refreshRate(row.currency)} className="ml-1 underline hover:no-underline">Retry</button>
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-semibold text-gray-800">₹{(rateState?.rate ?? 1).toFixed(4)}</div>
                            {rateState?.updatedAt && (
                              <div className="text-[10px] text-gray-400 mt-0.5">
                                Updated {new Date(rateState.updatedAt).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => refreshRate(row.currency)}
                            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                            title="Refresh rate"
                          >
                            <RefreshCw className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Buffer input */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-500 text-sm">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={cfg.markupPercent === 0 ? '' : cfg.markupPercent}
                          placeholder="0.00"
                          onChange={e => setMarkup(key, e.target.value)}
                          className="w-24 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-right"
                        />
                      </div>
                    </td>

                    {/* Effective Rate */}
                    <td className="px-5 py-4">
                      {isINR ? (
                        <span className="text-gray-500 text-xs">₹1.0000</span>
                      ) : rateState?.loading ? (
                        <span className="text-gray-400 text-xs">—</span>
                      ) : (
                        <div>
                          <div className={`font-semibold ${cfg.markupPercent > 0 ? 'text-primary' : 'text-gray-700'}`}>
                            ₹{effRate.toFixed(4)}
                          </div>
                          {cfg.markupPercent > 0 && !isINR && !rateState?.error && (
                            <div className="text-[10px] text-green-600 mt-0.5">
                              +₹{cfg.markupPercent} buffer
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Toggle: Show in INR */}
                    <td className="px-5 py-4 text-center">
                      <button
                        role="switch"
                        aria-checked={cfg.showInINR}
                        onClick={() => toggleShowInINR(key)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                          cfg.showInINR ? 'bg-primary' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            cfg.showInINR ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <div className={`text-[10px] mt-1 font-medium ${cfg.showInINR ? 'text-primary' : 'text-gray-400'}`}>
                        {cfg.showInINR ? 'INR' : 'Local'}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        Exchange rates sourced from open.er-api.com · Updated hourly · Buffer (flat ₹ INR) added on top of live rate
      </p>
    </div>
  )
}
