'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/firebase'
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import {
  Building2, User, Phone, Mail, FileText, Globe,
  MessageCircle, Save, Loader2, CheckCircle, AlertCircle,
  ExternalLink, Copy, Check, Shield, CreditCard, ToggleLeft, ToggleRight, Banknote, LogOut
} from 'lucide-react'
import { CURRENCIES } from '@/lib/utils/currency'
import LogoUploader from './LogoUploader'

interface Props {
  agentId: string
  agentSlug: string
  onSaved?: () => void
  onLogout?: () => void
}

interface AgentProfile {
  companyName: string
  contactName: string
  phone: string
  email: string
  gstNumber: string
  logoUrl: string
  whatsapp: string
  agencyType: string
  subscriptionPlan: string
  commissionRate: number
  fallbackToTravelzada: boolean
  website?: string
  baseCurrency?: string
}

const AGENCY_TYPES = ['individual', 'small_agency', 'large_agency', 'franchise']
const AGENCY_TYPE_LABELS: Record<string, string> = {
  individual: 'Individual Agent',
  small_agency: 'Small Agency (1–10 staff)',
  large_agency: 'Large Agency (10+ staff)',
  franchise: 'Franchise',
}

export default function AgentSettings({ agentId, agentSlug, onSaved, onLogout }: Props) {
  const router = useRouter()
  const [profile, setProfile] = useState<AgentProfile | null>(null)
  const [form, setForm] = useState<Partial<AgentProfile>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const plannerUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/tailored-travel/${agentSlug}`
    : `https://www.travelzada.com/tailored-travel/${agentSlug}`

  useEffect(() => {
    async function fetch() {
      try {
        const snap = await getDoc(doc(db, 'agents', agentId))
        if (snap.exists()) {
          const data = snap.data() as AgentProfile
          setProfile(data)
          setForm({
            companyName: data.companyName || '',
            contactName: data.contactName || '',
            phone: data.phone || '',
            gstNumber: data.gstNumber || '',
            logoUrl: data.logoUrl || '',
            whatsapp: data.whatsapp || '',
            agencyType: data.agencyType || 'individual',
            website: data.website || '',
            fallbackToTravelzada: data.fallbackToTravelzada || false,
            baseCurrency: data.baseCurrency || 'INR',
          })
        }
      } catch { } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [agentId])

  function handleChange(field: keyof AgentProfile, value: any) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    setError('')
    setSaving(true)
    try {
      await updateDoc(doc(db, 'agents', agentId), {
        ...form,
        updatedAt: serverTimestamp(),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      router.refresh()
      onSaved?.()
    } catch (err: any) {
      setError(err.message || 'Failed to save changes.')
    } finally {
      setSaving(false)
    }
  }

  function copyUrl() {
    navigator.clipboard.writeText(plannerUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">

      {/* ── Planner URL ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Globe className="w-4 h-4 text-gray-500" />
          Your Planner URL
        </h3>
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
          <p className="flex-1 text-sm font-mono text-gray-700 truncate">{plannerUrl}</p>
          <button onClick={copyUrl} className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 flex-shrink-0">
            {copied ? <><Check className="w-3.5 h-3.5 text-green-600" />Copied</> : <><Copy className="w-3.5 h-3.5" />Copy</>}
          </button>
          <a href={plannerUrl} target="_blank" className="text-primary hover:text-primary/80 flex-shrink-0">
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* ── Agency Profile ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-5">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-gray-500" />
          Agency Profile
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Company / Agency Name"
            icon={Building2}
            value={form.companyName || ''}
            onChange={v => handleChange('companyName', v)}
            placeholder="Your Travel Agency"
          />
          <FormField
            label="Contact Person Name"
            icon={User}
            value={form.contactName || ''}
            onChange={v => handleChange('contactName', v)}
            placeholder="Rajiv Mehta"
          />
          <FormField
            label="Phone Number"
            icon={Phone}
            value={form.phone || ''}
            onChange={v => handleChange('phone', v)}
            placeholder="+91 98765 43210"
            type="tel"
          />
          <FormField
            label="WhatsApp Number"
            icon={MessageCircle}
            value={form.whatsapp || ''}
            onChange={v => handleChange('whatsapp', v)}
            placeholder="+91 98765 43210"
            type="tel"
          />
          <FormField
            label="GST Number"
            icon={FileText}
            value={form.gstNumber || ''}
            onChange={v => handleChange('gstNumber', v)}
            placeholder="22AAAAA0000A1Z5"
          />
          <FormField
            label="Website (optional)"
            icon={Globe}
            value={form.website || ''}
            onChange={v => handleChange('website', v)}
            placeholder="https://yourwebsite.com"
            type="url"
          />
        </div>

        {/* Logo Upload */}
        <LogoUploader
          value={form.logoUrl || ''}
          onChange={url => handleChange('logoUrl', url)}
        />

        {/* Agency type */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-2">Agency Type</label>
          <div className="flex flex-wrap gap-2">
            {AGENCY_TYPES.map(type => (
              <button
                key={type}
                onClick={() => handleChange('agencyType', type)}
                className={`px-3.5 py-2 rounded-xl border text-sm font-medium transition-all ${
                  form.agencyType === type
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                {AGENCY_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Planner Settings ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Globe className="w-4 h-4 text-gray-500" />
          Planner Behaviour
        </h3>
        <div
          className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer select-none"
          onClick={() => handleChange('fallbackToTravelzada', !form.fallbackToTravelzada)}
        >
          <div>
            <p className="font-semibold text-gray-900 text-sm">Show Journaies packages as fallback</p>
            <p className="text-xs text-gray-500 mt-0.5">
              When you have no matching packages, show packages from Journaies catalog instead of an empty result.
            </p>
          </div>
          {form.fallbackToTravelzada ? (
            <ToggleRight className="w-7 h-7 text-green-600 flex-shrink-0" />
          ) : (
            <ToggleLeft className="w-7 h-7 text-gray-400 flex-shrink-0" />
          )}
        </div>
      </div>

      {/* ── Currency ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
          <Banknote className="w-4 h-4 text-gray-500" />
          Display Currency
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          All prices across your dashboard and packages will display in this currency.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {CURRENCIES.map(c => (
            <button
              key={c.code}
              onClick={() => handleChange('baseCurrency', c.code)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                form.baseCurrency === c.code
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="font-bold text-base leading-none">{c.symbol.trim()}</span>
              <span className="truncate">{c.code}</span>
            </button>
          ))}
        </div>
        {form.baseCurrency && form.baseCurrency !== 'INR' && (
          <p className="text-xs text-amber-600 mt-3 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            Note: Package prices are stored in their original currency. Dashboard totals reflect the values entered when packages were created.
          </p>
        )}
      </div>

      {/* ── Subscription (read-only) ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-gray-500" />
          Subscription & Commission
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <InfoBlock label="Plan" value={profile?.subscriptionPlan?.toUpperCase() || 'Basic'} />
          <InfoBlock label="Commission Rate" value={`${profile?.commissionRate || 0}%`} />
          <InfoBlock label="Agent Slug" value={agentSlug} mono />
        </div>
        <p className="text-xs text-gray-400 mt-4">
          To change your subscription plan or commission rate, contact{' '}
          <a href="mailto:support@travelzada.com" className="text-primary hover:underline">support@travelzada.com</a>
        </p>
      </div>

      {/* ── Save button ── */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
          ) : saved ? (
            <><CheckCircle className="w-4 h-4" />Saved!</>
          ) : (
            <><Save className="w-4 h-4" />Save Changes</>
          )}
        </button>

        {onLogout && (
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-5 py-3 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 hover:text-red-700 font-semibold text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />Sign Out
          </button>
        )}
      </div>
    </div>
  )
}

function FormField({
  label, icon: Icon, value, onChange, placeholder, type = 'text',
}: {
  label: string
  icon: any
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1.5">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
      />
    </div>
  )
}

function InfoBlock({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className={`text-sm font-bold text-gray-900 mt-1 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  )
}
