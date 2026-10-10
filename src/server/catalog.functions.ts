import { createServerFn } from '@tanstack/react-start'
import { deleteCookie, getRequest, setCookie } from '@tanstack/react-start/server'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { categories, items } from '../../db/schema.js'
import {
  SESSION_COOKIE,
  SESSION_DAYS,
  createSessionToken,
  getSetting,
  hashPassword,
  isAdmin,
  putSetting,
  requireAdmin,
  rotateSessionSecret,
  verifyPassword,
} from './auth.server'
import { deleteUploadedImages } from './images.server'
import { STORE_KEYS, loadCatalog, loadItem } from './catalog.server'
import { listOrders, loadPaymentSettings } from './orders.server'
import { FREE_SIZE } from '@/lib/catalog'
import { consumeResetToken, createResetToken, getRecoveryEmail, maskEmail, sendResetEmail } from './recovery.server'

/* ---------- Public ---------- */

export const getCatalog = createServerFn({ method: 'GET' }).handler(() => loadCatalog())

export const getItem = createServerFn({ method: 'GET' })
  .inputValidator((data: { id: number }) => data)
  .handler(({ data }) => loadItem(data.id))

/* ---------- Admin session ---------- */

async function startSession() {
  setCookie(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  })
}

export const getAdminState = createServerFn({ method: 'GET' }).handler(async () => {
  const hasPassword = Boolean(await getSetting('admin_password'))
  const loggedIn = hasPassword && (await isAdmin())
  const recoveryEmail = await getRecoveryEmail()
  return {
    hasPassword,
    loggedIn,
    // Full address only for a signed-in admin; the login screen gets a masked hint
    recoveryEmail: loggedIn ? recoveryEmail : maskEmail(recoveryEmail),
    catalog: loggedIn ? await loadCatalog({ includeHidden: true }) : null,
    orders: loggedIn ? await listOrders() : [],
    payment: loggedIn ? await loadPaymentSettings() : null,
  }
})

const passwordSchema = z.string().min(6, 'Password must be at least 6 characters')

export const setupPassword = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ password: passwordSchema }))
  .handler(async ({ data }) => {
    if (await getSetting('admin_password')) throw new Error('A password is already set. Please log in.')
    await putSetting('admin_password', hashPassword(data.password))
    await rotateSessionSecret()
    await startSession()
    return { ok: true }
  })

export const login = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ password: z.string() }))
  .handler(async ({ data }) => {
    const stored = await getSetting('admin_password')
    if (!stored || !verifyPassword(data.password, stored)) throw new Error('Incorrect password.')
    await startSession()
    return { ok: true }
  })

export const logout = createServerFn({ method: 'POST' }).handler(() => {
  deleteCookie(SESSION_COOKIE, { path: '/' })
  return { ok: true }
})

export const changePassword = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ current: z.string(), next: passwordSchema }))
  .handler(async ({ data }) => {
    await requireAdmin()
    const stored = await getSetting('admin_password')
    if (!stored || !verifyPassword(data.current, stored)) throw new Error('Current password is incorrect.')
    await putSetting('admin_password', hashPassword(data.next))
    await rotateSessionSecret()
    await startSession()
    return { ok: true }
  })

export const requestPasswordReset = createServerFn({ method: 'POST' }).handler(async () => {
  if (!(await getSetting('admin_password'))) throw new Error('No password has been set yet.')
  const email = await getRecoveryEmail()
  const token = await createResetToken()
  const link = `${new URL(getRequest().url).origin}/admin?reset=${token}`
  await sendResetEmail(email, link)
  return { sentTo: maskEmail(email) }
})

export const resetPassword = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ token: z.string().min(1), password: passwordSchema }))
  .handler(async ({ data }) => {
    if (!(await consumeResetToken(data.token))) {
      throw new Error('This reset link is invalid or has expired. Request a new one.')
    }
    await putSetting('admin_password', hashPassword(data.password))
    await rotateSessionSecret()
    await startSession()
    return { ok: true }
  })

/* ---------- Admin catalog management ---------- */

export const saveRecoveryEmail = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')) }))
  .handler(async ({ data }) => {
    await requireAdmin()
    await putSetting('recovery_email', data.email)
    return { email: data.email }
  })

export const saveWhatsapp = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ number: z.string() }))
  .handler(async ({ data }) => {
    await requireAdmin()
    const digits = data.number.replace(/\D/g, '')
    if (digits.length < 8 || digits.length > 15) {
      throw new Error('Enter the full number with country code, e.g. +977 97XXXXXXXX')
    }
    await putSetting('whatsapp', digits)
    return { whatsapp: digits }
  })

const optionalUrl = z.string().trim().max(300).refine((v) => v === '' || /^https?:\/\//.test(v), 'Links must start with https://')

export const saveStoreInfo = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      store_address: z.string().trim().max(300),
      store_hours: z.string().trim().max(300),
      store_phone: z.string().trim().max(40),
      store_map_url: optionalUrl,
      instagram: optionalUrl,
      tiktok: optionalUrl,
      facebook: optionalUrl,
    }),
  )
  .handler(async ({ data }) => {
    await requireAdmin()
    for (const key of STORE_KEYS) await putSetting(key, data[key])
    return data
  })

const itemSchema = z.object({
  id: z.number().int().optional(),
  name: z.string().trim().min(1, 'Name is required').max(120),
  categoryId: z.number().int().nullable(),
  price: z.number().int().min(0).nullable(),
  comparePrice: z.number().int().min(0).nullable(),
  description: z.string().max(2000),
  sizes: z.array(z.string().trim().min(1).max(20)).max(20),
  colors: z.array(z.string().trim().min(1).max(30)).max(10),
  images: z.array(z.string().max(300)).max(8),
  featured: z.boolean(),
  published: z.boolean(),
  clearance: z.boolean(),
  fabric: z.string().trim().max(60),
  pattern: z.string().trim().max(60),
  fit: z.string().trim().max(60),
  setContents: z.string().trim().max(120),
  occasions: z.array(z.string().trim().min(1).max(30)).max(8),
  badge: z.enum(['', 'new', 'bestseller', 'trending']),
  // Units per size ('Free Size' when no sizes are listed)
  stock: z.record(z.string().trim().min(1).max(20), z.number().int().min(0).max(100000)),
  // The stock the editor was opened with (omitted for new pieces)
  stockBefore: z.record(z.string(), z.number().int()).optional(),
  lookIds: z.array(z.number().int()).max(4),
}).refine((d) => d.comparePrice == null || (d.price != null && d.comparePrice > d.price), {
  message: 'The crossed-out price must be higher than the selling price.',
})

export const saveItem = createServerFn({ method: 'POST' })
  .inputValidator(itemSchema)
  .handler(async ({ data }) => {
    await requireAdmin()
    const { id, stockBefore, ...fields } = data
    const keys = fields.sizes.length ? fields.sizes : [FREE_SIZE]
    const withStock = (stock: Record<string, number>) => ({
      ...fields,
      stock,
      soldOutSizes: fields.sizes.filter((s) => !(stock[s] > 0)),
      lookIds: fields.lookIds.filter((x) => x !== id),
    })
    if (id) {
      const result = await db.transaction(async (tx) => {
        const [before] = await tx.select().from(items).where(eq(items.id, id)).for('update')
        if (!before) throw new Error('This piece no longer exists.')
        // Apply the owner's edits as a change from what the editor loaded, so orders placed meanwhile still count
        const stock = Object.fromEntries(
          keys.map((k) => {
            const edited = fields.stock[k] ?? 0
            if (!stockBefore || !(k in stockBefore)) return [k, edited]
            return [k, Math.max(0, (Number(before.stock[k]) || 0) + edited - stockBefore[k])]
          }),
        )
        const [row] = await tx.update(items).set(withStock(stock)).where(eq(items.id, id)).returning()
        return { row, before }
      })
      await deleteUploadedImages(result.before.images.filter((src) => !fields.images.includes(src)))
      return result.row
    }
    const [row] = await db
      .insert(items)
      .values(withStock(Object.fromEntries(keys.map((k) => [k, fields.stock[k] ?? 0]))))
      .returning()
    return row
  })

export const deleteItem = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    await requireAdmin()
    const [row] = await db.delete(items).where(eq(items.id, data.id)).returning()
    if (row) await deleteUploadedImages(row.images)
    return { ok: true }
  })

export const addCategory = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ name: z.string().trim().min(1).max(40) }))
  .handler(async ({ data }) => {
    await requireAdmin()
    const [{ max }] = await db
      .select({ max: sql<number>`coalesce(max(${categories.sortOrder}), 0)` })
      .from(categories)
    const [row] = await db
      .insert(categories)
      .values({ name: data.name, sortOrder: Number(max) + 1 })
      .onConflictDoNothing()
      .returning()
    if (!row) throw new Error('That category already exists.')
    return row
  })

export const renameCategory = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.number().int(), name: z.string().trim().min(1).max(40) }))
  .handler(async ({ data }) => {
    await requireAdmin()
    await db.update(categories).set({ name: data.name }).where(eq(categories.id, data.id))
    return { ok: true }
  })

// Items in a removed category become uncategorised ("Other") via ON DELETE SET NULL
export const deleteCategory = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    await requireAdmin()
    await db.delete(categories).where(eq(categories.id, data.id))
    return { ok: true }
  })
