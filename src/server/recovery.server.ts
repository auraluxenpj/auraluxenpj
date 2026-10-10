import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { getSetting, putSetting } from './auth.server'

export const DEFAULT_RECOVERY_EMAIL = 'auraluxe26@gmail.com'
const RESET_MINUTES = 30
const FROM = process.env.RESEND_FROM || 'AuraLuxe <onboarding@resend.dev>'

export async function getRecoveryEmail() {
  return (await getSetting('recovery_email')) ?? DEFAULT_RECOVERY_EMAIL
}

/** "au•••••26@gmail.com" — shown on the public login screen. */
export function maskEmail(email: string) {
  const [name, domain] = email.split('@')
  if (!name || !domain) return email
  const keep = name.length <= 4 ? 1 : 2
  return `${name.slice(0, keep)}${'•'.repeat(Math.max(name.length - keep * 2, 1))}${name.slice(-keep)}@${domain}`
}

const digest = (token: string) => createHash('sha256').update(token).digest('hex')

/** Stores only a hash of the token plus its expiry, as `expires.hash` in `settings.reset_token`. */
export async function createResetToken() {
  const token = randomBytes(32).toString('base64url')
  const expires = Date.now() + RESET_MINUTES * 60 * 1000
  await putSetting('reset_token', `${expires}.${digest(token)}`)
  return token
}

export async function consumeResetToken(token: string) {
  const stored = await getSetting('reset_token')
  if (!stored) return false
  const [expires, hash] = stored.split('.')
  if (!expires || !hash || Number(expires) < Date.now()) return false
  const expected = Buffer.from(hash, 'hex')
  const given = Buffer.from(digest(token), 'hex')
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false
  await putSetting('reset_token', '')
  return true
}

export async function sendResetEmail(to: string, link: string) {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    throw new Error('Email recovery is not switched on yet. Add a RESEND_API_KEY environment variable in Netlify.')
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      subject: 'Reset your AuraLuxe admin password',
      text: `Someone asked to reset the AuraLuxe shop admin password.\n\nChoose a new password here (the link works once and expires in ${RESET_MINUTES} minutes):\n${link}\n\nIf this wasn't you, ignore this email and your password stays the same.`,
    }),
  })
  if (!res.ok) {
    console.error('Resend error', res.status, await res.text())
    throw new Error('The reset email could not be sent. Please try again later.')
  }
}
