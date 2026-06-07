'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { LinkIcon, UserCog, ArrowRight } from 'lucide-react'

export default function JoinIndexPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-50 px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-xl p-10 max-w-md w-full text-center"
      >
        <div className="w-14 h-14 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <LinkIcon className="w-7 h-7 text-violet-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Travel Agent Registration</h1>
        <p className="text-gray-500 text-sm leading-relaxed mb-6">
          You need a registration link from your DMC or agency to create an account.
          Ask your manager to share the link from their{' '}
          <span className="font-semibold text-gray-700">Travel Agents</span> dashboard.
        </p>

        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-left mb-8">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Your link looks like:</p>
          <p className="text-sm font-mono text-violet-600 break-all">
            travelzada.com/join/<span className="text-gray-400">your-agency-name</span>
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/agent-login"
            className="flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            <UserCog className="w-4 h-4" />
            Sign In to Dashboard
          </Link>
          <Link
            href="/agent-register"
            className="flex items-center justify-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
          >
            Register as a DMC Partner
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
