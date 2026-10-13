import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { offers, settings } from '../../db/schema.js'
import type { Offer } from '../../db/schema.js'
import { requireAdmin } from './auth.server'
import { deleteUploadedImages } from './images.server'
import { audit, loadDeliverySettings } from './promo.server'
import { DEFAULT_ZONE, deliveryInputSchema, discountLabel, offerInputSchema } from '@/lib/promo'
import { formatPrice } from '@/lib/format'

const isUniqueViolation = (err: unknown) => {
  const e = err as { code?: string; cause?: { code?: string } }
  return e?.code === '23505' || e?.cause?.code === '23505'
}

/** Field-by-field before/after for the audit log (only what changed). */
function diff(before: Record<string, unknown>, after: Record<string, unknown>) {
  const out: Record<string, { from: unknown; to: unknown }> = {}
  for (const k of Object.keys(after)) {
    const a = before[k] instanceof Date ? (before[k] as Date).toISOString() : before[k]
    const b = after[k] instanceof Date ? (after[k] as Date).toISOString() : after[k]
    if (JSON.stringify(a) !== JSON.stringify(b)) out[k] = { from: a ?? null, to: b ?? null }
  }
  return out
}

export const saveOffer = createServerFn({ method: 'POST' })
  .inputValidator(offerInputSchema)
  .handler(async ({ data }) => {
    await requireAdmin()
    const { id, ...input } = data
    const values = {
      ...input,
      code: input.kind === 'coupon' ? input.code : null,
      stackable: input.kind === 'coupon' && input.stackable,
      maxDiscount: input.discountType === 'percent' ? input.maxDiscount : null,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      productIds: input.scope === 'products' ? input.productIds : [],
      categoryIds: input.scope === 'categories' ? input.categoryIds : [],
      updatedAt: new Date(),
    }
    const label = `${values.name}${values.code ? ` (${values.code})` : ''} — ${discountLabel(values)}`
    let oldImage = ''
    try {
      const saved = await db.transaction(async (tx) => {
        if (id) {
          const [before] = await tx.select().from(offers).where(eq(offers.id, id)).for('update')
          if (!before) throw new Error('This offer no longer exists.')
          const [row] = await tx.update(offers).set(values).where(eq(offers.id, id)).returning()
          const { updatedAt, ...changed } = diff(before, values)
          await audit(tx, { action: 'offer.update', entity: 'offer', entityId: id, summary: `Edited offer ${label}`, details: changed })
          if (before.bannerImage && before.bannerImage !== row.bannerImage) oldImage = before.bannerImage
          return row
        }
        const [row] = await tx.insert(offers).values(values).returning()
        await audit(tx, { action: 'offer.create', entity: 'offer', entityId: row.id, summary: `Created offer ${label}`, details: { ...input } })
        return row
      })
      if (oldImage) await deleteUploadedImages([oldImage])
      return saved
    } catch (err) {
      if (isUniqueViolation(err)) throw new Error(`The coupon code ${values.code} is already used by another offer.`)
      throw err
    }
  })

export const setOfferActive = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.number().int(), active: z.boolean() }))
  .handler(async ({ data }) => {
    await requireAdmin()
    const [row] = await db.update(offers).set({ active: data.active, updatedAt: new Date() }).where(eq(offers.id, data.id)).returning()
    if (!row) throw new Error('This offer no longer exists.')
    await audit(db, {
      action: data.active ? 'offer.activate' : 'offer.pause',
      entity: 'offer',
      entityId: row.id,
      summary: `${data.active ? 'Activated' : 'Paused'} offer ${row.name}${row.code ? ` (${row.code})` : ''}`,
    })
    return row
  })

/** Past orders keep their own copy of the offer name, code and discount, so deleting never changes history. */
export const deleteOffer = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    await requireAdmin()
    const [row] = await db.delete(offers).where(eq(offers.id, data.id)).returning()
    if (!row) return { ok: true }
    const { createdAt, updatedAt, ...snapshot } = row as Offer
    await audit(db, { action: 'offer.delete', entity: 'offer', entityId: row.id, summary: `Deleted offer ${row.name}${row.code ? ` (${row.code})` : ''}`, details: snapshot })
    if (row.bannerImage) await deleteUploadedImages([row.bannerImage])
    return { ok: true }
  })

export const saveDeliverySettings = createServerFn({ method: 'POST' })
  .inputValidator(deliveryInputSchema)
  .handler(async ({ data }) => {
    await requireAdmin()
    const before = await loadDeliverySettings()
    const zoneIds = new Set([DEFAULT_ZONE, ...data.zones.map((z) => z.id)])
    const free = {
      ...data.free,
      zoneIds: data.free.zoneIds.filter((id) => zoneIds.has(id)),
      productIds: data.free.scope === 'products' ? data.free.productIds : [],
      categoryIds: data.free.scope === 'categories' ? data.free.categoryIds : [],
    }
    const zones = data.zones.map((z) => ({ ...z, cities: [...new Set(z.cities.map((c) => c.trim()).filter(Boolean))] }))
    const rows = [
      { key: 'delivery_charge', value: String(data.baseCharge) },
      { key: 'delivery_zones', value: JSON.stringify(zones) },
      { key: 'free_delivery', value: JSON.stringify(free) },
    ]
    await db.transaction(async (tx) => {
      for (const r of rows) await tx.insert(settings).values(r).onConflictDoUpdate({ target: settings.key, set: { value: r.value } })
      const after = { baseCharge: data.baseCharge, zones, free }
      const changed = diff(before as unknown as Record<string, unknown>, after)
      const summary = free.enabled
        ? `Saved delivery settings — free delivery ON over ${formatPrice(free.min)}, standard charge ${formatPrice(data.baseCharge)}`
        : `Saved delivery settings — free delivery OFF, standard charge ${formatPrice(data.baseCharge)}`
      await audit(tx, { action: 'delivery.update', entity: 'delivery', summary, details: changed })
    })
    return { baseCharge: data.baseCharge, zones, free }
  })
