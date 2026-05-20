'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowRight, ArrowLeft } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import AuthRecoveryLayout from '@/components/auth/AuthRecoveryLayout';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus({ type: '', message: '' });

    try {
      const { error } = await authClient.forgetPassword({
        email,
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) {
        setStatus({ type: 'error', message: error.message || 'Failed to send reset link.' });
      } else {
        setStatus({
          type: 'success',
          message:
            'Reset link sent! Please check your inbox for instructions to reset your password.',
        });
      }
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'An unexpected error occurred.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthRecoveryLayout
      panelHeading={
        <>
          Account <span className="italic text-[#d4af37]">recovery</span>
        </>
      }
      panelSubtext="We&apos;ll email you a secure link to set a new password for your Citius Holidays account."
      formTitle="Reset password"
      formDescription="Enter your email and we'll send you a link to choose a new password."
    >
      {status.message ? (
        <div
          className={`mb-6 rounded-xl border p-4 text-sm ${
            status.type === 'success'
              ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
              : 'border-red-100 bg-red-50 text-red-600'
          }`}
        >
          {status.message}
        </div>
      ) : null}

      {status.type !== 'success' ? (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="group">
            <label className="mb-1.5 ml-1 block text-sm font-medium text-[#0f172a]">
              Email address
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-[#e2e8f0] bg-white py-3.5 pl-11 pr-4 text-lg text-[#0f172a] outline-none transition-all duration-200 placeholder:font-light placeholder:text-[#94a3b8] focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20"
              />
              <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#94a3b8] transition-colors group-focus-within:text-[#d4af37]" />
            </div>
          </div>

          <button
            disabled={isLoading}
            type="submit"
            className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-[#0B1026] py-4 text-lg font-medium text-white shadow-lg shadow-[#0B1026]/20 transition-all duration-300 hover:shadow-xl hover:shadow-[#0B1026]/30"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#0B1026] to-[#1a2c4e] opacity-100 transition-opacity group-hover:opacity-90" />
            <span className="relative z-10">{isLoading ? 'Sending...' : 'Send reset link'}</span>
            {!isLoading ? (
              <ArrowRight className="relative z-10 h-5 w-5 transition-transform group-hover:translate-x-1" />
            ) : null}
          </button>
        </form>
      ) : null}

      <div className="mt-8 text-center">
        <Link
          href="/auth"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#d4af37] transition-colors hover:text-[#b5952f]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
      </div>
    </AuthRecoveryLayout>
  );
}
