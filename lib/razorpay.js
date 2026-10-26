import { createHmac, timingSafeEqual } from 'crypto'

function getCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) throw new Error('Razorpay is not configured')
  return { keyId, keySecret }
}

async function razorpayRequest(path, options = {}) {
  const { keyId, keySecret } = getCredentials()
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(result.error?.description || 'Razorpay request failed')
    error.status = response.status
    throw error
  }
  return result
}

function safeEqualHex(expected, received) {
  if (!/^[a-f0-9]+$/i.test(received || '') || expected.length !== received.length) return false
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'))
}

export function getRazorpayKeyId() {
  return getCredentials().keyId
}

export function verifyCheckoutSignature(orderId, paymentId, signature) {
  const { keySecret } = getCredentials()
  const expected = createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex')
  return safeEqualHex(expected, signature)
}

export function verifyWebhookSignature(body, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) throw new Error('Razorpay webhook is not configured')
  const expected = createHmac('sha256', secret).update(body).digest('hex')
  return safeEqualHex(expected, signature)
}

export async function createRazorpayOrder({ amount, receipt, notes }) {
  return razorpayRequest('/orders', {
    method: 'POST',
    body: JSON.stringify({ amount, currency: 'INR', receipt, notes }),
  })
}

export async function getRazorpayPayment(paymentId) {
  return razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`)
}

export async function refundRazorpayPayment(paymentId) {
  return razorpayRequest(`/payments/${encodeURIComponent(paymentId)}/refund`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export { getCredentials }
