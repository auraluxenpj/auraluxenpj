import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { getCookie } from '@tanstack/react-start/server'
import { db } from '../../db/index.js'
import { settings } from '../../db/schema.js'

export const SESSION_COOKIE = 'auraluxe_admin'
export const SESSION_DAYS = 14

export async function getSetting(key: string) {
  const [row] = await db.select().from(settings).where(eq(settings.key, key))
  return row?.value ?? null
}

export async function putSetting(key: string, value: string) {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const candidate = scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  return candidate.length === expected.length && timingSafeEqual(candidate, expected)
}

function sign(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

/** Rotating the secret (on password change) signs every existing session out. */
export async function rotateSessionSecret() {
  const secret = randomBytes(32).toString('hex')
  await putSetting('session_secret', secret)
  return secret
}

export async function createSessionToken() {
  const secret = (await getSetting('session_secret')) ?? (await rotateSessionSecret())
  const expires = String(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  return `${expires}.${sign(expires, secret)}`
}

export async function isValidSession(token: string | undefined | null) {
  if (!token) return false
  const [expires, sig] = token.split('.')
  if (!expires || !sig || Number(expires) < Date.now()) return false
  const secret = await getSetting('session_secret')
  if (!secret) return false
  const expected = Buffer.from(sign(expires, secret), 'hex')
  const given = Buffer.from(sig, 'hex')
  return expected.length === given.length && timingSafeEqual(expected, given)
}

/** For server functions — reads the cookie from the current request. */
export async function isAdmin() {
  return isValidSession(getCookie(SESSION_COOKIE))
}

/** For raw API routes that receive a Request object. */
export async function isAdminRequest(request: Request) {
  const cookie = request.headers.get('cookie') ?? ''
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`))
  return isValidSession(match ? decodeURIComponent(match[1]) : null)
}

export async function requireAdmin() {
  if (!(await isAdmin())) throw new Error('Please log in again.')
}
