'use client';

import { useState } from 'react';
import Link from "next/link"
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowRight, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  User, 
  Sparkles, 
  Compass, 
  Map as MapIcon,
  Moon
} from 'lucide-react';
import { signInWithEmail, signUpWithEmail, signInWithGoogle } from '@/lib/auth-client';

export default function AuthPageClient({ initialMode = 'signin', callbackUrl = '/', error }) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode === 'signup' ? 'signup' : 'signin');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState(error || '');
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
  });

  const toggleMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setFormError('');
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setFormError('');

    try {
      if (mode === 'signin') {
        const result = await signInWithEmail({
          email: formData.email,
          password: formData.password,
        });
        
        if (result?.error) {
          setFormError(result.error.message || 'Failed to sign in');
        } else {
          router.push(callbackUrl);
          router.refresh();
        }
      } else {
        const result = await signUpWithEmail({
          email: formData.email,
          password: formData.password,
          name: formData.name,
        });
        
        if (result?.error) {
          setFormError(result.error.message || 'Failed to sign up');
        } else {
          router.push(callbackUrl);
          router.refresh();
        }
      }
    } catch (err) {
      setFormError(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle(callbackUrl);
    } catch (err) {
      setFormError('Failed to initialize Google sign in');
      setIsLoading(false);
    }
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { type: 'spring', stiffness: 100, damping: 10 }
    }
  };

  return (
    <div className={`min-h-screen w-full flex flex-col md:flex-row bg-[#FDFBF7]`}>
      {/* Left Side - The Atmosphere (Hidden on mobile, or reduced) */}
      <motion.div 
        className="relative hidden md:flex w-full md:w-1/2 lg:w-5/12 bg-[#0B1026] text-[#FDFBF7] overflow-hidden flex-col justify-between p-12"
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        {/* Abstract Background Elements */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-[#1a2c4e] via-[#0B1026] to-[#050814] opacity-80"></div>
          <div className="absolute bottom-[-20%] left-[-20%] w-[800px] h-[800px] rounded-full bg-[#1e293b] opacity-10 blur-3xl"></div>
          <div className="absolute top-[20%] right-[-10%] w-[400px] h-[400px] rounded-full bg-[#d4af37] opacity-5 blur-[100px]"></div>
          
          {/* Subtle noise texture overlay */}
          <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 h-full flex flex-col justify-between">
          <motion.div
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.4 }}
          >
            <div className="flex items-center gap-3 mb-2">
              <Compass className="w-6 h-6 text-[#d4af37]" />
              <span className="text-sm uppercase tracking-[0.2em] text-[#d4af37]">Citius Travel</span>
            </div>
            <h1 className="font-heading text-5xl lg:text-6xl leading-[1.1] font-medium tracking-tight mt-6">
              The Journey <br/>
              <span className="italic text-[#d4af37]">Within</span> Begins <br/>
              Here.
            </h1>
          </motion.div>

          <motion.div 
            className="space-y-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="p-2 rounded-lg bg-[#d4af37]/20 text-[#d4af37]">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-heading text-lg font-medium text-white mb-1">Curated Pilgrimages</h3>
                <p className="text-white/60 text-sm font-light leading-relaxed">
                  Discover destinations that speak to your soul, from the peaks of Kailash to the temples of Kyoto.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="p-2 rounded-lg bg-[#d4af37]/20 text-[#d4af37]">
                <MapIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-heading text-lg font-medium text-white mb-1">Seamless Exploration</h3>
                <p className="text-white/60 text-sm font-light leading-relaxed">
                  Let us handle the details while you focus on the experience. Expert guides, luxury stays, peace of mind.
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             transition={{ delay: 0.8 }}
             className="text-xs text-white/30 font-light"
          >
            © {new Date().getFullYear()} Citius Travel. All rights reserved.
          </motion.div>
        </div>
      </motion.div>

      {/* Right Side - The Form */}
      <div className="w-full md:w-1/2 lg:w-7/12 flex items-center justify-center p-6 md:p-12 relative">
        <motion.div 
          className="w-full max-w-md"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          {/* Mobile Header (visible only on small screens) */}
          <div className="md:hidden mb-8 text-center">
             <div className="flex items-center justify-center gap-2 mb-4">
              <Compass className="w-6 h-6 text-[#0B1026]" />
              <span className="text-sm uppercase tracking-[0.2em] text-[#0B1026]">Citius Travel</span>
            </div>
            <h1 className="font-heading text-4xl text-[#0B1026]">Welcome</h1>
          </div>

          <motion.div variants={itemVariants} className="mb-8">
            <h2 className="font-heading text-4xl md:text-5xl text-[#0B1026] mb-3">
              {mode === 'signin' ? 'Welcome Back' : 'Join the Circle'}
            </h2>
            <p className="text-[#0B1026]/60 font-light text-lg">
              {mode === 'signin' 
                ? 'Enter your details to access your journey.' 
                : 'Begin your spiritual travel experience today.'}
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="space-y-4 mb-8">
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 bg-white border border-[#e2e8f0] hover:bg-[#f8fafc] hover:border-[#cbd5e1] text-[#0f172a] p-4 rounded-xl transition-all duration-300 group shadow-sm hover:shadow-md"
            >
              <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              <span className="font-medium">Continue with Google</span>
            </button>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-[#e2e8f0]"></div>
              <span className="flex-shrink-0 mx-4 text-[#94a3b8] text-sm font-light uppercase tracking-wider">Or continue with</span>
              <div className="flex-grow border-t border-[#e2e8f0]"></div>
            </div>
          </motion.div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <AnimatePresence mode="wait">
              {mode === 'signup' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="group">
                    <label className="block text-sm font-medium text-[#0f172a] mb-1.5 ml-1">Full Name</label>
                    <div className="relative">
                      <input
                        type="text"
                        name="name"
                        required={mode === 'signup'}
                        value={formData.name}
                        onChange={handleInputChange}
                        className="w-full bg-white border border-[#e2e8f0] text-[#0f172a] text-lg px-4 py-3.5 pl-11 rounded-xl focus:ring-2 focus:ring-[#d4af37]/20 focus:border-[#d4af37] outline-none transition-all duration-200 placeholder:text-[#94a3b8] placeholder:font-light"
                        placeholder="John Doe"
                      />
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94a3b8] group-focus-within:text-[#d4af37] transition-colors" />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div variants={itemVariants} className="group">
              <label className="block text-sm font-medium text-[#0f172a] mb-1.5 ml-1">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full bg-white border border-[#e2e8f0] text-[#0f172a] text-lg px-4 py-3.5 pl-11 rounded-xl focus:ring-2 focus:ring-[#d4af37]/20 focus:border-[#d4af37] outline-none transition-all duration-200 placeholder:text-[#94a3b8] placeholder:font-light"
                  placeholder="you@example.com"
                />
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94a3b8] group-focus-within:text-[#d4af37] transition-colors" />
              </div>
            </motion.div>

            <motion.div variants={itemVariants} className="group">
              <div className="flex items-center justify-between mb-1.5 ml-1">
                <label className="block text-sm font-medium text-[#0f172a]">Password</label>
                {/* //TODO: Add forgot password link */}
                {/* {mode === 'signin' && (
                  <Link href="/auth/forgot-password" className="text-sm text-[#d4af37] hover:text-[#b5952f] transition-colors">
                    Forgot password?
                  </Link>
                )} */}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full bg-white border border-[#e2e8f0] text-[#0f172a] text-lg px-4 py-3.5 pl-11 pr-11 rounded-xl focus:ring-2 focus:ring-[#d4af37]/20 focus:border-[#d4af37] outline-none transition-all duration-200 placeholder:text-[#94a3b8] placeholder:font-light"
                  placeholder="••••••••"
                />
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94a3b8] group-focus-within:text-[#d4af37] transition-colors" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#0f172a] transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </motion.div>

            {formError && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                {formError}
              </motion.div>
            )}

            <motion.button
              variants={itemVariants}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={isLoading}
              type="submit"
              className="w-full bg-[#0B1026] text-white font-medium text-lg py-4 rounded-xl shadow-lg shadow-[#0B1026]/20 hover:shadow-xl hover:shadow-[#0B1026]/30 transition-all duration-300 flex items-center justify-center gap-2 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[#0B1026] to-[#1a2c4e] opacity-100 group-hover:opacity-90 transition-opacity" />
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay" />
              <span className="relative z-10">{isLoading ? 'Processing...' : (mode === 'signin' ? 'Sign In' : 'Create Account')}</span>
              {!isLoading && <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />}
            </motion.button>
          </form>

          <motion.div variants={itemVariants} className="mt-8 text-center">
            <p className="text-[#64748b]">
              {mode === 'signin' ? "Don't have an account?" : "Already have an account?"}
              <button
                onClick={toggleMode}
                className="ml-2 font-medium text-[#d4af37] hover:text-[#b5952f] transition-colors relative group"
              >
                {mode === 'signin' ? 'Sign up' : 'Sign in'}
                <span className="absolute -bottom-0.5 left-0 w-0 h-0.5 bg-[#d4af37] transition-all group-hover:w-full" />
              </button>
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}




