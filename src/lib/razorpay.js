/**
 * Razorpay Client Helper
 * 
 * Initializes and exports the Razorpay SDK client for use in API routes.
 * Razorpay is the standard payment gateway for UPI, Netbanking, and Cards in India.
 */

import Razorpay from 'razorpay';
import crypto from 'crypto';

// Validate environment variables
const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
  console.warn(
    'Razorpay credentials not configured. ' +
    'Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env.local'
  );
}

// Initialize Razorpay instance
// Note: We create this lazily to avoid errors during build when env vars aren't available
let razorpayInstance = null;

export function getRazorpay() {
  if (!razorpayInstance) {
    if (!keyId || !keySecret) {
      throw new Error('Razorpay credentials not configured');
    }
    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }
  return razorpayInstance;
}

/**
 * Create a Razorpay order for payment
 * 
 * @param {Object} options
 * @param {number} options.amount - Amount in smallest currency unit (paise for INR)
 * @param {string} options.currency - Currency code ('INR' or 'USD')
 * @param {string} options.receipt - Unique receipt ID for this order
 * @param {Object} options.notes - Additional metadata
 * @returns {Promise<Object>} Razorpay order object
 */
export async function createOrder({ amount, currency = 'INR', receipt, notes = {} }) {
  const razorpay = getRazorpay();
  
  const options = {
    amount, // Amount in paise (smallest currency unit)
    currency,
    receipt,
    notes,
    payment_capture: 1, // Auto-capture payment
  };

  try {
    const order = await razorpay.orders.create(options);
    return order;
  } catch (error) {
    console.error('Razorpay order creation failed:', error);
    throw new Error(`Failed to create Razorpay order: ${error.message}`);
  }
}

/**
 * Verify Razorpay payment signature
 * This is critical for security - always verify before confirming a booking
 * 
 * @param {Object} params
 * @param {string} params.orderId - Razorpay order ID
 * @param {string} params.paymentId - Razorpay payment ID
 * @param {string} params.signature - Signature from Razorpay callback
 * @returns {boolean} True if signature is valid
 */
export function verifyPaymentSignature({ orderId, paymentId, signature }) {
  if (!keySecret) {
    throw new Error('Razorpay key secret not configured');
  }

  // Razorpay signature verification formula:
  // signature = HMAC-SHA256(orderId + "|" + paymentId, secret)
  const body = orderId + '|' + paymentId;
  
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(body)
    .digest('hex');

  return expectedSignature === signature;
}

/**
 * Verify Razorpay webhook signature
 * Used to validate incoming webhook requests
 * 
 * @param {string} body - Raw request body as string
 * @param {string} signature - X-Razorpay-Signature header value
 * @param {string} webhookSecret - Webhook secret from Razorpay dashboard
 * @returns {boolean} True if webhook signature is valid
 */
export function verifyWebhookSignature(body, signature, webhookSecret) {
  if (!webhookSecret) {
    throw new Error('Webhook secret not provided');
  }

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(body)
    .digest('hex');

  return expectedSignature === signature;
}

/**
 * Fetch order details from Razorpay
 * 
 * @param {string} orderId - Razorpay order ID
 * @returns {Promise<Object>} Order details
 */
export async function fetchOrder(orderId) {
  const razorpay = getRazorpay();
  return await razorpay.orders.fetch(orderId);
}

/**
 * Fetch payment details from Razorpay
 * 
 * @param {string} paymentId - Razorpay payment ID
 * @returns {Promise<Object>} Payment details
 */
export async function fetchPayment(paymentId) {
  const razorpay = getRazorpay();
  return await razorpay.payments.fetch(paymentId);
}

/**
 * Initiate a refund for a payment
 * 
 * @param {string} paymentId - Razorpay payment ID
 * @param {number} amount - Amount to refund (optional, full refund if not specified)
 * @returns {Promise<Object>} Refund details
 */
export async function createRefund(paymentId, amount = null) {
  const razorpay = getRazorpay();
  const options = amount ? { amount } : {};
  return await razorpay.payments.refund(paymentId, options);
}

// Export the key ID for frontend use (this is safe to expose)
export const razorpayKeyId = keyId;











