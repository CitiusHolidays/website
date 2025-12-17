# Spiritual Trails - Backend Infrastructure

## Architecture Overview

This document describes the backend booking infrastructure for the Spiritual Trails B2C travel platform.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           VERCEL DEPLOYMENT                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │   Next.js    │    │  BetterAuth  │    │   Razorpay   │              │
│  │   Frontend   │───▶│     Auth     │    │   Checkout   │              │
│  └──────────────┘    └──────────────┘    └──────────────┘              │
│         │                   │                   │                       │
│         ▼                   ▼                   ▼                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     API Routes (Serverless)                      │   │
│  │  /api/auth/*  │  /api/create-order  │  /api/webhooks/razorpay   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              ▼                                          │
│                    ┌──────────────────┐                                │
│                    │   Drizzle ORM    │                                │
│                    └──────────────────┘                                │
│                              │                                          │
└──────────────────────────────┼──────────────────────────────────────────┘
                               ▼
                    ┌──────────────────┐
                    │     Supabase     │
                    │   PostgreSQL     │
                    │  (Pooled Conn)   │
                    └──────────────────┘
```

## Tech Stack

| Component     | Technology          | Rationale                                    |
|--------------|---------------------|----------------------------------------------|
| Database     | PostgreSQL/Supabase | Connection pooling, reliable on Vercel       |
| ORM          | Drizzle ORM         | Lightweight, edge-optimized, type-safe       |
| Auth         | BetterAuth          | Modern, flexible, database-backed            |
| Payments     | Razorpay            | India-standard (UPI, Netbanking, Cards)      |
| Encryption   | AES-256-GCM         | Industry-standard for sensitive data         |

---

## File Structure

```
src/
├── lib/
│   ├── db/
│   │   ├── schema.js      # Drizzle schema definitions
│   │   ├── index.js       # Database connection
│   │   └── queries.js     # Reusable query helpers
│   ├── auth.js            # BetterAuth configuration (server)
│   ├── auth-client.js     # BetterAuth client (browser)
│   ├── razorpay.js        # Razorpay SDK wrapper
│   └── encryption.js      # AES-256-GCM encryption utilities
│
├── app/api/
│   ├── auth/[...all]/route.js       # BetterAuth handlers
│   ├── create-order/route.js        # Create Razorpay order
│   ├── verify-payment/route.js      # Verify payment signature
│   └── webhooks/razorpay/route.js   # Razorpay webhook handler
│
drizzle.config.js                     # Drizzle Kit configuration
```

---

## Database Schema

### Tables

**users** - Customer accounts
- `id` (UUID, PK)
- `email` (unique)
- `name`, `phoneNumber`
- `passportDetailsEncrypted` (AES-256 encrypted JSON)

**trips** - Available pilgrimage packages
- `id` (UUID, PK)
- `name`, `slug`, `description`
- `startDate`, `endDate`
- `totalSeats`, `availableSeats`
- `priceInr`, `priceUsd` (in smallest currency unit)
- `itinerary`, `inclusions`, `exclusions` (JSONB)

**bookings** - Customer reservations
- `id` (UUID, PK)
- `userId` → users.id
- `tripId` → trips.id
- `status` ('pending', 'confirmed', 'failed', 'cancelled', 'refunded')
- `razorpayOrderId`, `razorpayPaymentId`
- `totalAmount`, `currency`
- `travelers`, `travelerDetails` (JSONB)

**sessions**, **accounts**, **verifications** - BetterAuth tables

---

## Environment Variables

Add these to `.env.local`:

```bash
# Database (Supabase)
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres

# Authentication
NEXT_PUBLIC_APP_URL=http://localhost:3000
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=<generate with: openssl rand -base64 32>

# Google OAuth
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>

# Razorpay
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=<from Razorpay Dashboard>
RAZORPAY_WEBHOOK_SECRET=<from Razorpay Webhooks>

# Encryption
ENCRYPTION_KEY=<generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))">
```

---

## Setup Instructions

### 1. Install Dependencies

```bash
bun install
# or
npm install
```

### 2. Setup Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Settings → Database → Connection string**
3. Copy the **URI** with **Pooler** enabled
4. Add to `DATABASE_URL` in `.env.local`

### 3. Run Migrations

```bash
# Push schema directly (development)
bun run db:push

# Or generate and run migrations (production)
bun run db:generate
bun run db:migrate
```

### 4. Setup Razorpay

1. Sign up at [razorpay.com](https://razorpay.com)
2. Go to **Settings → API Keys** and generate keys
3. Add to `.env.local`
4. For webhooks:
   - Go to **Settings → Webhooks**
   - Add URL: `https://your-domain.com/api/webhooks/razorpay`
   - Select events: `payment.authorized`, `payment.captured`, `payment.failed`
   - Copy webhook secret to `RAZORPAY_WEBHOOK_SECRET`

### 5. Setup Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials
3. Add authorized redirect URI: `https://your-domain.com/api/auth/callback/google`
4. Add credentials to `.env.local`

---

## API Reference

### POST /api/create-order

Creates a Razorpay order for a trip booking.

**Request:**
```json
{
  "tripId": "uuid",
  "userId": "uuid",
  "travelers": 2,
  "currency": "INR",
  "travelerDetails": [
    { "name": "John Doe", "age": 45 }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "order": { "id": "order_xxx", "amount": 500000 },
  "booking": { "id": "uuid", "status": "pending" },
  "razorpay": {
    "key": "rzp_xxx",
    "orderId": "order_xxx",
    "amount": 500000,
    "prefill": { "name": "...", "email": "..." }
  }
}
```

### POST /api/verify-payment

Verifies payment after Razorpay Checkout.

**Request:**
```json
{
  "razorpay_order_id": "order_xxx",
  "razorpay_payment_id": "pay_xxx",
  "razorpay_signature": "signature"
}
```

### POST /api/webhooks/razorpay

Receives webhooks from Razorpay. Configured in Razorpay Dashboard.

---

## Frontend Integration

### 1. Authentication

```jsx
import { signInWithEmail, signInWithGoogle, useSession } from '@/lib/auth-client';

// Sign up
await signUpWithEmail({
  email: 'user@example.com',
  password: 'SecurePass123',
  name: 'John Doe',
  phoneNumber: '+91 98765 43210'
});

// Sign in
await signInWithEmail({ email, password });
await signInWithGoogle('/dashboard');

// Get session
const { data: session } = useSession();
```

### 2. Booking Flow

```jsx
// 1. Create order
const response = await fetch('/api/create-order', {
  method: 'POST',
  body: JSON.stringify({ tripId, userId, travelers: 2 })
});
const { razorpay } = await response.json();

// 2. Open Razorpay Checkout
const rzp = new Razorpay({
  key: razorpay.key,
  order_id: razorpay.orderId,
  amount: razorpay.amount,
  currency: razorpay.currency,
  name: razorpay.name,
  prefill: razorpay.prefill,
  handler: async (response) => {
    // 3. Verify payment
    await fetch('/api/verify-payment', {
      method: 'POST',
      body: JSON.stringify({
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature
      })
    });
  }
});
rzp.open();
```

---

## Security Considerations

1. **Passport Data**: Encrypted with AES-256-GCM before storage
2. **Payment Verification**: Double verification (client + webhook)
3. **Webhook Security**: HMAC-SHA256 signature verification
4. **Rate Limiting**: BetterAuth rate limits auth endpoints
5. **Session Security**: Secure cookies in production, short-lived tokens

---

## Deployment Checklist

- [ ] Set all environment variables in Vercel
- [ ] Run database migrations (`db:migrate`)
- [ ] Update `BETTER_AUTH_URL` to production URL
- [ ] Update Google OAuth redirect URIs
- [ ] Configure Razorpay webhook with production URL
- [ ] Enable Razorpay live mode (swap test keys for live keys)
- [ ] Verify connection pooling is enabled in Supabase











