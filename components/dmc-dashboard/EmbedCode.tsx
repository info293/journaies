'use client'

import { useState } from 'react'
import {
  Check, Copy, Code2, Globe, Puzzle, ExternalLink,
  ChevronDown, ChevronUp, LayoutTemplate, MessageSquareMore, Link2, FileCode2,
} from 'lucide-react'

interface Props {
  agentSlug: string
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors bg-white border border-gray-200 px-2.5 py-1.5 rounded-lg"
    >
      {copied
        ? <><Check className="w-3.5 h-3.5 text-green-600" />Copied!</>
        : <><Copy className="w-3.5 h-3.5" />Copy</>}
    </button>
  )
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative group">
      <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap break-all font-mono">
        {code}
      </pre>
      <div className="absolute top-3 right-3">
        <CopyButton text={code} />
      </div>
    </div>
  )
}

// ── Colour swatches for bubble mode ─────────────────────────────────────────
const SWATCHES = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#0ea5e9', '#1f2937', '#000000',
]

export default function EmbedCode({ agentSlug }: Props) {
  const BASE       = typeof window !== 'undefined' ? window.location.origin : 'https://www.travelzada.com'
  const plannerUrl = `${BASE}/tailored-travel/${agentSlug}?embed=1`
  const widgetUrl  = `${BASE}/embed/widget.js`

  // ── Shared ───────────────────────────────────────────────────────────────
  const [mainMode, setMainMode] = useState<'inline' | 'bubble' | 'page'>('inline')

  // ── Inline options ───────────────────────────────────────────────────────
  const [inlineTab, setInlineTab]     = useState<'script' | 'webcomponent' | 'iframe'>('script')
  const [height, setHeight]           = useState('720')
  const [rounded, setRounded]         = useState('16')
  const [showPreview, setShowPreview] = useState(false)

  // ── Dedicated page options ───────────────────────────────────────────────
  const [pageSlug, setPageSlug] = useState('/trip-planner')

  // ── Bubble options ───────────────────────────────────────────────────────
  const [bubbleTab, setBubbleTab]     = useState<'script' | 'webcomponent'>('script')
  const [bubbleColor, setBubbleColor] = useState('#6366f1')
  const [bubbleLabel, setBubbleLabel] = useState('Plan Your Trip ✈️')
  const [bubblePos, setBubblePos]     = useState<'right' | 'left'>('right')
  const [showBubblePreview, setShowBubblePreview] = useState(false)
  const [bubbleOpen, setBubbleOpen]   = useState(false)

  // ── Code strings ─────────────────────────────────────────────────────────
  const inlineScriptCode =
`<!-- AI Planner — inline embed -->
<script
  src="${widgetUrl}"
  data-agent="${agentSlug}"
  data-height="${height}px"
  data-rounded="${rounded}">
</script>`

  const inlineWebComponentCode =
`<!-- Step 1: load script once in <head> or before </body> -->
<script src="${widgetUrl}"></script>

<!-- Step 2: place anywhere on your page -->
<travelzada-planner
  agent="${agentSlug}"
  height="${height}px"
  rounded="${rounded}">
</travelzada-planner>`

  const inlineIframeCode =
`<iframe
  src="${plannerUrl}"
  width="100%"
  height="${height}px"
  style="border:none;border-radius:${rounded}px;display:block;"
  allow="geolocation"
  allowfullscreen>
</iframe>`

  const bubbleScriptCode =
`<!-- AI Planner — floating bot widget -->
<script
  src="${widgetUrl}"
  data-agent="${agentSlug}"
  data-mode="bubble"
  data-color="${bubbleColor}"
  data-label="${bubbleLabel}"
  data-position="${bubblePos}">
</script>`

  const bubbleWebComponentCode =
`<!-- Step 1: load script once in <head> or before </body> -->
<script src="${widgetUrl}"></script>

<!-- Step 2: place this anywhere (widget appears as floating button) -->
<travelzada-planner
  agent="${agentSlug}"
  mode="bubble"
  color="${bubbleColor}"
  label="${bubbleLabel}"
  position="${bubblePos}">
</travelzada-planner>`

  const inlineActiveCode =
    inlineTab === 'script' ? inlineScriptCode :
    inlineTab === 'webcomponent' ? inlineWebComponentCode : inlineIframeCode

  const bubbleActiveCode = bubbleTab === 'script' ? bubbleScriptCode : bubbleWebComponentCode

  const INLINE_TABS = [
    { id: 'script'       as const, label: 'Script Tag',     icon: Code2,   desc: 'Easiest — one line' },
    { id: 'webcomponent' as const, label: 'Web Component',  icon: Puzzle,  desc: 'Modern — full control' },
    { id: 'iframe'       as const, label: 'Plain iFrame',   icon: Globe,   desc: 'Universal — works everywhere' },
  ]
  const BUBBLE_TABS = [
    { id: 'script'       as const, label: 'Script Tag',    icon: Code2,  desc: 'Easiest — paste & go' },
    { id: 'webcomponent' as const, label: 'Web Component', icon: Puzzle, desc: 'Modern — reusable tag' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}

      {/* ── Shareable direct link ───────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-primary/5 to-purple-50 border border-primary/20 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <Link2 className="w-4 h-4 text-primary" />
          <p className="text-sm font-bold text-gray-900">Your Planner Link</p>
          <span className="text-[10px] font-bold bg-primary text-white px-2 py-0.5 rounded-full">Shareable</span>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Share this link directly with customers — no website needed. Works on WhatsApp, email, Instagram bio, anywhere.
        </p>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5">
          <Globe className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span className="flex-1 text-sm text-gray-700 font-mono truncate">{`${BASE}/tailored-travel/${agentSlug}`}</span>
          <CopyButton text={`${BASE}/tailored-travel/${agentSlug}`} />
          <a
            href={`/tailored-travel/${agentSlug}`} target="_blank"
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline flex-shrink-0"
          >
            <ExternalLink className="w-3 h-3" />Open
          </a>
        </div>
      </div>

      {/* ── Mode selector ──────────────────────────────────────────────────── */}
      <div>
        <p className="text-sm font-bold text-gray-700 mb-3">Or embed on your website</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Inline card */}
        <button
          onClick={() => setMainMode('inline')}
          className={`flex items-start gap-4 p-5 rounded-2xl border-2 text-left transition-all ${
            mainMode === 'inline'
              ? 'border-primary bg-primary/5 shadow-sm'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
            mainMode === 'inline' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'
          }`}>
            <LayoutTemplate className="w-6 h-6" />
          </div>
          <div>
            <p className={`text-sm font-bold ${mainMode === 'inline' ? 'text-primary' : 'text-gray-800'}`}>
              Inline Planner
            </p>
            <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
              Embed the full planner as a section on your page — like a form or booking widget.
            </p>
          </div>
        </button>

        {/* Bubble card */}
        <button
          onClick={() => setMainMode('bubble')}
          className={`flex items-start gap-4 p-5 rounded-2xl border-2 text-left transition-all ${
            mainMode === 'bubble'
              ? 'border-purple-500 bg-purple-50 shadow-sm'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
            mainMode === 'bubble' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-500'
          }`}>
            <MessageSquareMore className="w-6 h-6" />
          </div>
          <div>
            <p className={`text-sm font-bold ${mainMode === 'bubble' ? 'text-purple-600' : 'text-gray-800'}`}>
              Floating Bot Widget
            </p>
            <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
              A floating button in the corner of your site (like WhatsApp) — click to open the AI planner.
            </p>
          </div>
        </button>

        {/* Dedicated page card */}
        <button
          onClick={() => setMainMode('page')}
          className={`flex items-start gap-4 p-5 rounded-2xl border-2 text-left transition-all ${
            mainMode === 'page'
              ? 'border-emerald-500 bg-emerald-50 shadow-sm'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
            mainMode === 'page' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'
          }`}>
            <FileCode2 className="w-6 h-6" />
          </div>
          <div>
            <p className={`text-sm font-bold ${mainMode === 'page' ? 'text-emerald-600' : 'text-gray-800'}`}>
              Dedicated Page
            </p>
            <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
              Host the planner at your own URL — e.g. <span className="font-mono">yourdomain.com/trip-planner</span>.
            </p>
          </div>
        </button>
      </div>

      {/* ══════════════ INLINE MODE ══════════════ */}
      {mainMode === 'inline' && (
        <>
          {/* Customise */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-4">Customise</h3>
            <div className="flex flex-wrap gap-5">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Height (px)</label>
                <input
                  type="number" value={height} onChange={e => setHeight(e.target.value)}
                  min={400} max={1200}
                  className="w-28 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Border Radius (px)</label>
                <input
                  type="number" value={rounded} onChange={e => setRounded(e.target.value)}
                  min={0} max={32}
                  className="w-28 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div className="flex items-end">
                <a
                  href={`/tailored-travel/${agentSlug}?embed=1`} target="_blank"
                  className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />Preview embed URL
                </a>
              </div>
            </div>
          </div>

          {/* Tab selector */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {INLINE_TABS.map(t => (
              <button
                key={t.id} onClick={() => setInlineTab(t.id)}
                className={`flex items-start gap-3 p-4 rounded-2xl border text-left transition-all ${
                  inlineTab === t.id
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  inlineTab === t.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  <t.icon className="w-4 h-4" />
                </div>
                <div>
                  <p className={`text-sm font-bold ${inlineTab === t.id ? 'text-primary' : 'text-gray-800'}`}>{t.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Code block */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 text-sm">
                {inlineTab === 'script' ? 'Script Tag' : inlineTab === 'webcomponent' ? 'Web Component' : 'iFrame'} Code
              </h3>
              <CopyButton text={inlineActiveCode} />
            </div>
            <CodeBlock code={inlineActiveCode} />
            {inlineTab === 'script' && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
                <strong>How to use:</strong> Paste this <code className="bg-blue-100 px-1 rounded">&lt;script&gt;</code> tag anywhere
                in your page body. The planner appears exactly where you place it.
              </div>
            )}
            {inlineTab === 'webcomponent' && (
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-sm text-purple-800">
                <strong>How to use:</strong> Load the script once in your <code className="bg-purple-100 px-1 rounded">&lt;head&gt;</code>,
                then use the <code className="bg-purple-100 px-1 rounded">&lt;travelzada-planner&gt;</code> tag anywhere on your page.
              </div>
            )}
            {inlineTab === 'iframe' && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800">
                <strong>How to use:</strong> Paste this <code className="bg-amber-100 px-1 rounded">&lt;iframe&gt;</code> wherever
                you want the planner. Works on Wix, Squarespace, and other site builders that block custom scripts.
              </div>
            )}
          </div>

          {/* Live preview */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => setShowPreview(v => !v)}
              className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
            >
              <span>Live Preview</span>
              {showPreview ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {showPreview && (
              <div className="border-t border-gray-100 p-4">
                <iframe
                  src={plannerUrl} width="100%" height={`${height}px`}
                  style={{ border: 'none', borderRadius: `${rounded}px`, display: 'block', background: '#f9fafb' }}
                  allow="geolocation"
                />
              </div>
            )}
          </div>

          {/* Embed mode notes */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600">
            <p className="font-semibold text-gray-800 mb-2">What's different in embed mode?</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Header & footer are hidden</li>
              <li>Login gate is skipped — visitors go straight to the planner</li>
              <li>All bookings and sessions are tracked in your CRM</li>
              <li>Your DMC branding banner stays visible</li>
            </ul>
          </div>
        </>
      )}

      {/* ══════════════ BUBBLE MODE ══════════════ */}
      {mainMode === 'bubble' && (
        <>
          {/* Customise */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-5">
            <h3 className="font-semibold text-gray-900 text-sm">Customise Widget</h3>

            {/* Button label */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Button Label / Tooltip</label>
              <input
                type="text" value={bubbleLabel} onChange={e => setBubbleLabel(e.target.value)}
                maxLength={40}
                className="w-full max-w-sm px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400"
              />
            </div>

            {/* Color */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Button Colour</label>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex flex-wrap gap-2">
                  {SWATCHES.map(c => (
                    <button
                      key={c} onClick={() => setBubbleColor(c)}
                      title={c}
                      className={`w-7 h-7 rounded-full transition-transform ${bubbleColor === c ? 'ring-2 ring-offset-2 ring-gray-800 scale-110' : 'hover:scale-110'}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color" value={bubbleColor} onChange={e => setBubbleColor(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200"
                  />
                  <span className="text-xs text-gray-500 font-mono">{bubbleColor}</span>
                </div>
              </div>
            </div>

            {/* Position */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Button Position</label>
              <div className="flex gap-3">
                {(['right', 'left'] as const).map(pos => (
                  <button
                    key={pos} onClick={() => setBubblePos(pos)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      bubblePos === pos
                        ? 'border-purple-400 bg-purple-50 text-purple-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    Bottom {pos.charAt(0).toUpperCase() + pos.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Live widget preview */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => setShowBubblePreview(v => !v)}
              className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
            >
              <span>Widget Preview</span>
              {showBubblePreview
                ? <ChevronUp className="w-4 h-4 text-gray-400" />
                : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {showBubblePreview && (
              <div className="border-t border-gray-100 p-6">
                <p className="text-xs text-gray-400 mb-4 text-center">This is how the widget appears on your visitors' screen</p>
                {/* Mock browser chrome */}
                <div className="relative bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl h-72 overflow-hidden border border-gray-200">
                  {/* Fake page content */}
                  <div className="p-6 space-y-3">
                    <div className="h-3 w-40 bg-gray-300/70 rounded-full" />
                    <div className="h-2 w-64 bg-gray-300/50 rounded-full" />
                    <div className="h-2 w-52 bg-gray-300/50 rounded-full" />
                  </div>

                  {/* Floating panel preview */}
                  {bubbleOpen && (
                    <div
                      className="absolute bottom-16 rounded-2xl shadow-2xl overflow-hidden w-60"
                      style={{ [bubblePos === 'right' ? 'right' : 'left']: '12px' }}
                    >
                      <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: bubbleColor }}>
                        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <rect x="4" y="7" width="16" height="11" rx="3" fill="white" opacity="0.9"/>
                            <circle cx="9" cy="12.5" r="1.5" fill={bubbleColor}/>
                            <circle cx="15" cy="12.5" r="1.5" fill={bubbleColor}/>
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-[11px] font-bold truncate">{bubbleLabel}</p>
                          <p className="text-white/70 text-[9px] flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />AI Planner • Online
                          </p>
                        </div>
                        <button
                          onClick={() => setBubbleOpen(false)}
                          className="text-white/70 hover:text-white text-base leading-none"
                        >✕</button>
                      </div>
                      <div className="bg-gray-50 h-28 flex items-center justify-center">
                        <p className="text-xs text-gray-400">AI Planner loads here</p>
                      </div>
                    </div>
                  )}

                  {/* Floating button */}
                  <button
                    onClick={() => setBubbleOpen(v => !v)}
                    className="absolute bottom-3 w-11 h-11 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110"
                    style={{
                      [bubblePos === 'right' ? 'right' : 'left']: '12px',
                      background: bubbleColor,
                    }}
                  >
                    {bubbleOpen
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>
                      : <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                          <rect x="4" y="7" width="16" height="11" rx="3" fill="white" opacity="0.95"/>
                          <circle cx="9" cy="12.5" r="1.5" fill={bubbleColor}/>
                          <circle cx="15" cy="12.5" r="1.5" fill={bubbleColor}/>
                          <path d="M12 4v3" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                          <circle cx="12" cy="3.5" r="1" fill="white"/>
                        </svg>
                    }
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-3 text-center">Click the button in the preview to toggle it open/closed</p>
              </div>
            )}
          </div>

          {/* Tab selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {BUBBLE_TABS.map(t => (
              <button
                key={t.id} onClick={() => setBubbleTab(t.id)}
                className={`flex items-start gap-3 p-4 rounded-2xl border text-left transition-all ${
                  bubbleTab === t.id
                    ? 'border-purple-500 bg-purple-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  bubbleTab === t.id ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  <t.icon className="w-4 h-4" />
                </div>
                <div>
                  <p className={`text-sm font-bold ${bubbleTab === t.id ? 'text-purple-600' : 'text-gray-800'}`}>{t.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Code block */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 text-sm">
                {bubbleTab === 'script' ? 'Script Tag' : 'Web Component'} Code
              </h3>
              <CopyButton text={bubbleActiveCode} />
            </div>
            <CodeBlock code={bubbleActiveCode} />
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-sm text-purple-800">
              <strong>How to use:</strong> Paste this once before your closing{' '}
              <code className="bg-purple-100 px-1 rounded">&lt;/body&gt;</code> tag.
              A floating bot button instantly appears in the {bubblePos === 'right' ? 'bottom-right' : 'bottom-left'} corner
              of your website — no other changes needed.
            </div>
          </div>

          {/* Notes */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600">
            <p className="font-semibold text-gray-800 mb-2">How the floating widget works</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Visitor sees a floating bot icon in the corner of your site</li>
              <li>Clicking it opens a chat panel with your AI planner inside</li>
              <li>The planner loads lazily — only when the visitor first opens it</li>
              <li>All leads and sessions are tracked in your DMC dashboard</li>
              <li>Your DMC branding is shown inside the panel</li>
              <li>Works on WordPress, Wix, Webflow, Shopify, and any HTML site</li>
            </ul>
          </div>
        </>
      )}

      {/* ══════════════ DEDICATED PAGE MODE ══════════════ */}
      {mainMode === 'page' && (() => {
        const fullHtmlTemplate: string =
`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AI Trip Planner</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; overflow: hidden; background: #f9fafb; }
  </style>
</head>
<body>
  <!-- AI Planner — fullpage mode -->
  <script
    src="${widgetUrl}"
    data-agent="${agentSlug}"
    data-mode="fullpage">
  </script>
</body>
</html>`

        const scriptOnlyCode =
`<!-- Add this to any existing page on your site -->
<script
  src="${widgetUrl}"
  data-agent="${agentSlug}"
  data-mode="fullpage">
</script>`

        return (
          <>
            {/* How it works */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
              <p className="text-sm font-bold text-emerald-800 mb-3">How this works</p>
              <div className="flex flex-col gap-3">
                {[
                  ['1', 'Create a new page on your website', 'e.g. create a page called "trip-planner" in WordPress, Wix, or your HTML files'],
                  ['2', 'Paste the code below into that page', 'The script automatically fills the entire page with the AI planner'],
                  ['3', 'Share the URL with your customers', 'e.g. yourdomain.com/trip-planner — your branding, your domain'],
                ].map(([num, title, desc]) => (
                  <div key={num} className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {num}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* URL preview */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
              <h3 className="font-semibold text-gray-900 text-sm">What your page URL will look like</h3>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
                  <span className="px-3 py-2 text-sm text-gray-400 border-r border-gray-200 flex-shrink-0">yourdomain.com</span>
                  <input
                    type="text"
                    value={pageSlug}
                    onChange={e => setPageSlug(e.target.value.startsWith('/') ? e.target.value : '/' + e.target.value)}
                    className="flex-1 px-3 py-2 text-sm text-gray-800 bg-transparent focus:outline-none font-mono"
                    placeholder="/trip-planner"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400">
                Example: if your domain is <span className="font-mono text-gray-600">ravindranathjha.in</span> and
                you create a page at <span className="font-mono text-gray-600">{pageSlug}</span>, the
                full URL will be{' '}
                <span className="font-mono text-emerald-600 font-semibold">ravindranathjha.in{pageSlug}</span>
              </p>
            </div>

            {/* Code option 1: Full HTML file */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">Option A — Full HTML File</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Best for static sites, cPanel hosting, or any plain HTML setup</p>
                </div>
                <CopyButton text={fullHtmlTemplate} />
              </div>
              <CodeBlock code={fullHtmlTemplate} />
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-sm text-emerald-800">
                <strong>How to use:</strong> Copy this code, save it as{' '}
                <code className="bg-emerald-100 px-1 rounded">trip-planner.html</code> (or whatever matches your slug),
                and upload it to your web server. The planner fills the entire page automatically.
              </div>
            </div>

            {/* Code option 2: Script only */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">Option B — Script Tag Only</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Best for WordPress, Wix, Webflow — paste into any existing page</p>
                </div>
                <CopyButton text={scriptOnlyCode} />
              </div>
              <CodeBlock code={scriptOnlyCode} />
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
                <strong>How to use:</strong> In your page editor (WordPress block editor, Wix HTML embed block, etc.),
                create a new blank page at <code className="bg-blue-100 px-1 rounded">{pageSlug}</code> and add
                this script tag. The planner takes over the full page.
              </div>
            </div>

            {/* Platform instructions */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
              <h3 className="font-semibold text-gray-900 text-sm">Platform-specific steps</h3>
              <div className="space-y-3">
                {[
                  {
                    platform: 'WordPress',
                    color: 'bg-blue-50 border-blue-100 text-blue-800',
                    steps: 'Pages → Add New → set URL slug to "trip-planner" → add a "Custom HTML" block → paste Option B code → Publish',
                  },
                  {
                    platform: 'Wix',
                    color: 'bg-amber-50 border-amber-100 text-amber-800',
                    steps: 'Add Page → blank page → URL slug = "trip-planner" → Add Element → Embed Code → HTML iframe → paste Option B → Publish',
                  },
                  {
                    platform: 'Webflow',
                    color: 'bg-purple-50 border-purple-100 text-purple-800',
                    steps: 'Pages → New Page → slug "trip-planner" → add Embed element → paste Option B → Publish',
                  },
                  {
                    platform: 'Plain HTML / cPanel',
                    color: 'bg-emerald-50 border-emerald-100 text-emerald-800',
                    steps: 'Save Option A as trip-planner.html → upload via File Manager or FTP to your domain root → done',
                  },
                ].map(p => (
                  <div key={p.platform} className={`rounded-xl p-3 border text-sm ${p.color}`}>
                    <span className="font-bold">{p.platform}:</span>{' '}{p.steps}
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600">
              <p className="font-semibold text-gray-800 mb-2">What happens when a visitor opens the page</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>The entire page becomes the AI planner — no scrolling, no distractions</li>
                <li>Your DMC name and branding are shown at the top of the planner</li>
                <li>Visitors plan trips, submit leads — all tracked in your dashboard</li>
                <li>The URL stays as <span className="font-mono font-semibold">yourdomain.com{pageSlug}</span> — 100% your brand</li>
                <li>No platform logo or branding visible to the visitor</li>
              </ul>
            </div>
          </>
        )
      })()}
    </div>
  )
}
