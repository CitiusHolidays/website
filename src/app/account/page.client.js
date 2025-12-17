'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Map as MapIcon, 
  Calendar, 
  Settings, 
  LogOut, 
  ChevronRight,
  Plane,
  Clock,
  CheckCircle2,
  XCircle,
  Compass
} from 'lucide-react';
import { logout } from '@/lib/auth-client';

export default function AccountClient({ user, bookings = [] }) {
  const [activeTab, setActiveTab] = useState('journeys');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [profileData, setProfileData] = useState(user);
  const [profileForm, setProfileForm] = useState({
    name: user.name || '',
    phoneNumber: user.phoneNumber || '',
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileAlert, setProfileAlert] = useState(null);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
    window.location.href = '/';
  };

  const phoneRegex = /^(\+\d{1,3}[\s.-]?)?\(?([0-9]{3})\)?[\s.-]?([0-9]{3})[\s.-]?([0-9]{4})$/;

  const handleProfileInput = (field, value) => {
    setProfileForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetProfileForm = () => {
    setProfileForm({
      name: profileData.name || '',
      phoneNumber: profileData.phoneNumber || '',
    });
    setIsEditingProfile(false);
    setProfileAlert(null);
  };

  const handleProfileSave = async () => {
    const trimmedName = (profileForm.name || '').trim();
    const trimmedPhone = (profileForm.phoneNumber || '').trim();

    if (!trimmedName || trimmedName.length < 2) {
      setProfileAlert({
        type: 'error',
        message: 'Please enter your full name (at least 2 characters).',
      });
      return;
    }

    if (trimmedName.length > 80) {
      setProfileAlert({
        type: 'error',
        message: 'Name is too long. Please keep it under 80 characters.',
      });
      return;
    }

    if (trimmedPhone && !phoneRegex.test(trimmedPhone)) {
      setProfileAlert({
        type: 'error',
        message: 'Please enter a valid phone number (e.g., +1 555-123-4567).',
      });
      return;
    }

    setIsSavingProfile(true);
    setProfileAlert(null);

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: trimmedName,
          phoneNumber: trimmedPhone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Unable to update profile.');
      }

      setProfileData((prev) => ({
        ...prev,
        ...data.user,
      }));
      setProfileForm({
        name: data.user?.name || '',
        phoneNumber: data.user?.phoneNumber || '',
      });
      setIsEditingProfile(false);
      setProfileAlert({
        type: 'success',
        message: 'Profile updated successfully.',
      });
    } catch (error) {
      setProfileAlert({
        type: 'error',
        message: error.message || 'Unable to update profile.',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const upcomingBookings = bookings.filter(b => b.booking.status !== 'cancelled' && new Date(b.trip.startDate) >= new Date());
  const pastBookings = bookings.filter(b => b.booking.status !== 'cancelled' && new Date(b.trip.startDate) < new Date());
  const cancelledBookings = bookings.filter(b => b.booking.status === 'cancelled');

  const memberSince = profileData?.createdAt
    ? new Date(profileData.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Not available';

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
    <div className="min-h-screen bg-[#FDFBF7] font-sans">
      {/* Hero Section */}
      <div className="relative h-[40vh] min-h-[400px] overflow-hidden bg-[#0B1026] text-[#FDFBF7] flex items-end pb-12">
        {/* Abstract Background */}
        <div className="absolute inset-0 z-0">
           <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-[#1a2c4e] via-[#0B1026] to-[#050814] opacity-80"></div>
          <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[#d4af37] opacity-5 blur-[120px]"></div>
          <div className="absolute bottom-[-10%] left-[10%] w-[400px] h-[400px] rounded-full bg-[#1e293b] opacity-20 blur-3xl"></div>
          <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col md:flex-row md:items-end justify-between gap-8"
          >
            <div>
              <div className="flex items-center gap-3 mb-4 text-[#d4af37]/80">
                <Compass className="w-5 h-5" />
                <span className="text-xs font-medium uppercase tracking-[0.2em]">Traveler Profile</span>
              </div>
              <h1 className="font-heading text-5xl md:text-7xl font-medium tracking-tight leading-none mb-2">
                Hello, <span className="italic text-[#d4af37]">{user.name?.split(' ')[0] || 'Traveler'}</span>
              </h1>
              <p className="text-white/60 font-light max-w-lg">
                Your journey log and personal preferences.
              </p>
            </div>

            <div className="flex gap-4">
               <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 min-w-[140px]">
                 <span className="block text-2xl font-heading text-white">{upcomingBookings.length}</span>
                 <span className="text-xs text-white/50 uppercase tracking-wider">Upcoming</span>
               </div>
               <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 min-w-[140px]">
                 <span className="block text-2xl font-heading text-white">{pastBookings.length}</span>
                 <span className="text-xs text-white/50 uppercase tracking-wider">Past Trips</span>
               </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-12 -mt-8 relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Sidebar Navigation */}
          <div className="lg:col-span-3">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-2xl shadow-xl shadow-[#0B1026]/5 p-2 sticky top-24"
            >
              <nav className="flex flex-col gap-1">
                <NavButton 
                  active={activeTab === 'journeys'} 
                  onClick={() => setActiveTab('journeys')}
                  icon={<MapIcon size={18} />}
                  label="My Journeys"
                />
                <NavButton 
                  active={activeTab === 'profile'} 
                  onClick={() => setActiveTab('profile')}
                  icon={<User size={18} />}
                  label="Profile Details"
                />
                <NavButton 
                  active={activeTab === 'settings'} 
                  onClick={() => setActiveTab('settings')}
                  icon={<Settings size={18} />}
                  label="Settings"
                />
                
                <div className="my-2 border-t border-gray-100"></div>
                
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-colors text-sm font-medium"
                >
                  <LogOut size={18} />
                  <span>{isLoggingOut ? 'Signing out...' : 'Sign Out'}</span>
                </button>
              </nav>
            </motion.div>
          </div>

          {/* Content Area */}
          <div className="lg:col-span-9">
            <AnimatePresence mode="wait">
              {activeTab === 'journeys' && (
                <motion.div
                  key="journeys"
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, y: 10 }}
                  variants={containerVariants}
                  className="space-y-12"
                >
                  {/* Upcoming Trips */}
                  <section>
                    <motion.h2 variants={itemVariants} className="font-heading text-3xl text-[#0B1026] mb-6 flex items-center gap-3">
                      Upcoming Journeys
                      <span className="text-sm font-sans font-normal text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{upcomingBookings.length}</span>
                    </motion.h2>
                    
                    {upcomingBookings.length > 0 ? (
                      <div className="grid gap-6">
                        {upcomingBookings.map((booking) => (
                          <BookingCard key={booking.booking.id} booking={booking} type="upcoming" />
                        ))}
                      </div>
                    ) : (
                      <motion.div variants={itemVariants} className="bg-white rounded-2xl p-12 text-center border border-dashed border-gray-200">
                        <div className="w-16 h-16 bg-[#0B1026]/5 rounded-full flex items-center justify-center mx-auto mb-4 text-[#0B1026]">
                          <Plane size={24} />
                        </div>
                        <h3 className="font-heading text-xl text-[#0B1026] mb-2">No upcoming journeys</h3>
                        <p className="text-gray-500 font-light mb-6">You haven&apos;t booked any trips yet. The world is waiting.</p>
                        <Link href="/services" className="inline-flex items-center gap-2 bg-[#0B1026] text-white px-6 py-3 rounded-full hover:bg-[#1a2c4e] transition-colors">
                          Explore Destinations <ChevronRight size={16} />
                        </Link>
                      </motion.div>
                    )}
                  </section>

                  {/* Past Trips */}
                  {pastBookings.length > 0 && (
                    <section>
                      <motion.h2 variants={itemVariants} className="font-heading text-3xl text-[#0B1026] mb-6 mt-12 opacity-80">
                        Past Memories
                      </motion.h2>
                      <div className="grid gap-6 opacity-80 hover:opacity-100 transition-opacity duration-300">
                        {pastBookings.map((booking) => (
                          <BookingCard key={booking.booking.id} booking={booking} type="past" />
                        ))}
                      </div>
                    </section>
                  )}
                </motion.div>
              )}

              {activeTab === 'profile' && (
                <motion.div
                  key="profile"
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, y: 10 }}
                  variants={containerVariants}
                  className="bg-white rounded-3xl shadow-xl shadow-[#0B1026]/5 overflow-hidden"
                >
                  <div className="p-8 border-b border-gray-100">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h2 className="font-heading text-3xl text-[#0B1026]">Personal Details</h2>
                        <p className="text-sm text-gray-500 font-light">Update how we reach you and what shows on bookings.</p>
                      </div>
                      {!isEditingProfile ? (
                        <button
                          onClick={() => {
                            setIsEditingProfile(true);
                            setProfileAlert(null);
                          }}
                          className="text-[#0B1026] text-sm font-semibold px-4 py-2 rounded-full border border-[#0B1026] hover:bg-[#0B1026] hover:text-white transition-colors"
                        >
                          Edit Details
                        </button>
                      ) : (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={resetProfileForm}
                            className="px-4 py-2 text-sm font-medium text-gray-600 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleProfileSave}
                            disabled={isSavingProfile}
                            className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors ${
                              isSavingProfile
                                ? 'bg-[#0B1026]/60 text-white cursor-not-allowed'
                                : 'bg-[#0B1026] text-white hover:bg-[#1a2c4e]'
                            }`}
                          >
                            {isSavingProfile ? 'Saving...' : 'Save Changes'}
                          </button>
                        </div>
                      )}
                    </div>
                    {profileAlert && (
                      <ProfileAlert type={profileAlert.type} message={profileAlert.message} />
                    )}
                  </div>
                  
                  {!isEditingProfile ? (
                    <div className="p-8 grid md:grid-cols-2 gap-x-12 gap-y-8">
                      <ProfileField label="Full Name" value={profileData.name} />
                      <ProfileField label="Email Address" value={profileData.email} />
                      <ProfileField label="Phone Number" value={profileData.phoneNumber || 'Not provided'} />
                      <ProfileField label="Member Since" value={memberSince} />
                    </div>
                  ) : (
                    <div className="p-8 grid md:grid-cols-2 gap-x-12 gap-y-8">
                      <ProfileInput
                        label="Full Name"
                        value={profileForm.name}
                        onChange={(value) => handleProfileInput('name', value)}
                        placeholder="Enter your full name"
                      />
                      <ProfileInput
                        label="Email Address"
                        value={profileData.email}
                        disabled
                      />
                      <ProfileInput
                        label="Phone Number"
                        value={profileForm.phoneNumber}
                        onChange={(value) => handleProfileInput('phoneNumber', value)}
                        placeholder="+1 555-123-4567"
                        type="tel"
                      />
                      <ProfileField label="Member Since" value={memberSince} />
                    </div>
                  )}

                  <div className="bg-[#f8fafc] p-8 border-t border-gray-100">
                    <h3 className="font-heading text-xl text-[#0B1026] mb-4">Passport Details</h3>
                    <p className="text-gray-500 text-sm font-light mb-4">
                      Your passport details are securely encrypted. We only decrypt them when necessary for booking arrangements.
                    </p>
                    <div className="flex items-center gap-3 text-sm text-gray-500 bg-white border border-gray-200 rounded-lg p-4 max-w-md">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      {profileData.passportDetailsEncrypted ? 'Passport details on file' : 'No passport details provided'}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'settings' && (
                <motion.div
                  key="settings"
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, y: 10 }}
                  variants={containerVariants}
                  className="bg-white rounded-3xl shadow-xl shadow-[#0B1026]/5 overflow-hidden"
                >
                  <div className="p-8 border-b border-gray-100">
                    <h2 className="font-heading text-3xl text-[#0B1026]">Account Settings</h2>
                  </div>
                  
                  <div className="divide-y divide-gray-100">
                    <SettingRow 
                      title="Email Notifications" 
                      description="Receive updates about your bookings and exclusive offers."
                      action={<Toggle />}
                    />
                    <SettingRow 
                      title="Two-Factor Authentication" 
                      description="Add an extra layer of security to your account."
                      action={<button className="text-[#d4af37] text-sm font-medium">Enable</button>}
                    />
                     <SettingRow 
                      title="Delete Account" 
                      description="Permanently remove your account and all data."
                      action={<button className="text-red-500 text-sm font-medium">Delete</button>}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
        active 
          ? 'bg-[#0B1026] text-white shadow-lg shadow-[#0B1026]/20' 
          : 'text-gray-500 hover:bg-gray-50 hover:text-[#0B1026]'
      }`}
    >
      <span className={active ? 'text-[#d4af37]' : ''}>{icon}</span>
      <span className={`text-sm font-medium ${active ? '' : 'font-light'}`}>{label}</span>
      {active && <ChevronRight size={14} className="ml-auto text-white/30" />}
    </button>
  );
}

function BookingCard({ booking, type }) {
  const { trip, booking: bookingData } = booking;
  
  return (
    <motion.div 
      variants={{
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1 }
      }}
      className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:shadow-[#0B1026]/10 transition-all duration-500 border border-gray-100 flex flex-col md:flex-row h-full md:h-56"
    >
      {/* Image Side */}
      <div className="w-full md:w-1/3 relative overflow-hidden h-48 md:h-full">
        {trip.coverImage ? (
           <Image
            src={trip.coverImage}
            alt={trip.name}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
            <MapIcon className="text-gray-400" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent md:bg-gradient-to-r md:from-transparent md:to-black/10"></div>
        
        <div className="absolute top-4 left-4">
          <span className={`px-3 py-1 rounded-full text-xs font-medium backdrop-blur-md ${
            bookingData.status === 'confirmed' ? 'bg-green-500/20 text-white border border-green-500/30' : 
            bookingData.status === 'pending' ? 'bg-yellow-500/20 text-white border border-yellow-500/30' :
            'bg-gray-500/20 text-white'
          }`}>
            {bookingData.status.charAt(0).toUpperCase() + bookingData.status.slice(1)}
          </span>
        </div>
      </div>

      {/* Content Side */}
      <div className="p-6 md:p-8 flex flex-col justify-between w-full md:w-2/3">
        <div>
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-heading text-2xl text-[#0B1026] group-hover:text-[#d4af37] transition-colors">
              {trip.name}
            </h3>
            <span className="font-heading text-lg font-medium text-[#0B1026]">
              {bookingData.currency} {bookingData.totalAmount.toLocaleString()}
            </span>
          </div>
          
          <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-500 font-light">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-[#d4af37]" />
              <span>{new Date(trip.startDate).toLocaleDateString()} - {new Date(trip.endDate).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <User size={16} className="text-[#d4af37]" />
              <span>{bookingData.travelers} Traveler{bookingData.travelers > 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-[#d4af37]" />
              <span>{Math.ceil((new Date(trip.endDate) - new Date(trip.startDate)) / (1000 * 60 * 60 * 24))} Days</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-100">
           <div className="text-xs text-gray-400">
             Booking ID: <span className="font-mono text-gray-500">{bookingData.id.slice(0, 8)}...</span>
           </div>
           <Link 
            href={`/services/${trip.slug}`} // Assuming this is where trips live
            className="flex items-center gap-2 text-sm font-medium text-[#0B1026] hover:text-[#d4af37] transition-colors"
           >
             View Trip Details <ChevronRight size={14} />
           </Link>
        </div>
      </div>
    </motion.div>
  );
}

function ProfileAlert({ type = 'success', message }) {
  const isSuccess = type === 'success';
  const Icon = isSuccess ? CheckCircle2 : XCircle;

  return (
    <div
      className={`mt-4 flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${
        isSuccess
          ? 'bg-green-50 border-green-100 text-green-800'
          : 'bg-red-50 border-red-100 text-red-700'
      }`}
    >
      <Icon size={18} />
      <span className="font-medium">{message}</span>
    </div>
  );
}

function ProfileInput({ label, value, onChange, placeholder, type = 'text', disabled = false }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{label}</label>
      <input
        type={type}
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className={`w-full border border-gray-200 rounded-xl px-4 py-3 text-[#0B1026] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-[#d4af37]/70 transition shadow-sm ${
          disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white'
        }`}
      />
    </div>
  );
}

function ProfileField({ label, value }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{label}</label>
      <div className="text-lg text-[#0B1026] font-medium border-b border-gray-100 pb-2">
        {value || '—'}
      </div>
    </div>
  );
}

function SettingRow({ title, description, action }) {
  return (
    <div className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
      <div>
        <h4 className="text-[#0B1026] font-medium">{title}</h4>
        <p className="text-gray-500 text-sm font-light mt-1">{description}</p>
      </div>
      <div>{action}</div>
    </div>
  );
}

function Toggle() {
  const [isOn, setIsOn] = useState(true);
  return (
    <button 
      onClick={() => setIsOn(!isOn)}
      className={`w-12 h-6 rounded-full p-1 transition-colors ${isOn ? 'bg-[#0B1026]' : 'bg-gray-200'}`}
    >
      <motion.div 
        layout
        className={`w-4 h-4 rounded-full bg-white shadow-sm`}
        animate={{ x: isOn ? 24 : 0 }}
      />
    </button>
  );
}

