'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Compass, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { authClient } from '@/lib/auth-client';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      setStatus({ type: 'error', message: 'Reset token is missing or invalid. Please request a new link.' });
      return;
    }
    if (password !== confirmPassword) {
      setStatus({ type: 'error', message: 'Passwords do not match.' });
      return;
    }
    if (password.length < 8) {
      setStatus({ type: 'error', message: 'Password must be at least 8 characters.' });
      return;
    }

    setIsLoading(true);
    setStatus({ type: '', message: '' });

    try {
      const { error } = await authClient.resetPassword({
        newPassword: password,
        token,
      });

      if (error) {
        setStatus({ type: 'error', message: error.message || 'Failed to reset password.' });
      } else {
        setStatus({
          type: 'success',
          message: 'Password reset successful! You can now log in with your new password.',
        });
        setTimeout(() => {
          router.push('/auth');
        }, 3000);
      }
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'An unexpected error occurred.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-col items-center mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Compass className="w-8 h-8 text-[#0B1026]" />
          <span className="text-sm font-semibold uppercase tracking-[0.2em] text-[#0B1026]">Citius Travel</span>
        </div>
        <h2 className="font-heading text-3xl font-semibold text-[#0B1026] text-center mt-4">Set New Password</h2>
        <p className="text-[#0B1026]/60 text-sm font-light text-center mt-2">
          Choose a secure, strong password for your staff or traveler account.
        </p>
      </div>

      {status.message && (
        <div
          className={`p-4 rounded-xl text-sm mb-6 border ${
            status.type === 'success'
              ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
              : 'bg-red-50 border-red-100 text-red-600'
          }`}
        >
          {status.message}
        </div>
      )}

      {status.type !== 'success' && (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="group">
            <label className="block text-sm font-medium text-[#0f172a] mb-1.5 ml-1">New Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full bg-white border border-[#e2e8f0] text-[#0f172a] text-lg px-4 py-3.5 pl-11 pr-11 rounded-xl focus:ring-2 focus:ring-[#d4af37]/20 focus:border-[#d4af37] outline-none transition-all duration-200"
              />
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94a3b8]" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#0f172a] transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="group">
            <label className="block text-sm font-medium text-[#0f172a] mb-1.5 ml-1">Confirm New Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="w-full bg-white border border-[#e2e8f0] text-[#0f172a] text-lg px-4 py-3.5 pl-11 rounded-xl focus:ring-2 focus:ring-[#d4af37]/20 focus:border-[#d4af37] outline-none transition-all duration-200"
              />
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94a3b8]" />
            </div>
          </div>

          <button
            disabled={isLoading}
            type="submit"
            className="w-full bg-[#0B1026] text-white font-medium text-lg py-4 rounded-xl shadow-lg transition-all duration-300 flex items-center justify-center gap-2 relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#0B1026] to-[#1a2c4e] opacity-100 group-hover:opacity-90 transition-opacity" />
            <span className="relative z-10">{isLoading ? 'Saving...' : 'Set Password'}</span>
            {!isLoading && <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />}
          </button>
        </form>
      )}

      {status.type === 'success' && (
        <div className="mt-6 text-center">
          <Link
            href="/auth"
            className="text-sm font-medium text-[#d4af37] hover:text-[#b5952f] transition-colors"
          >
            Redirecting to Login...
          </Link>
        </div>
      )}
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-[#060814] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#1e295d,transparent_50%)] opacity-30" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,#08201a,transparent_50%)] opacity-40" />
      <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white border border-[#e2e8f0]/10 rounded-2xl shadow-2xl p-8 relative z-10"
      >
        <Suspense fallback={<div className="text-center p-4">Loading reset portal...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </motion.div>
    </div>
  );
}
