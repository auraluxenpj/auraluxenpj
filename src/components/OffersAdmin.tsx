import { useRouter } from '@tanstack/react-router'
import {
  CalendarClock,
  Gift,
  History,
  ImagePlus,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Tag,
  Trash2,
  Truck,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Category, Item } from '../../db/schema'
import type { getAdminState } from '@/server/catalog.functions'
import { deleteOffer, saveDeliverySettings, saveOffer, setOfferActive } from '@/server/promo.functions'
import { DEFAULT_ZONE, OFFER_STATE_LABEL, deliveryInputSchema, discountLabel, freeDeliveryLive, offerInputSchema } from '@/lib/promo'
import type { OfferState } from '@/lib/promo'
import { cdn, formatPrice } from '@/lib/format'
import { uploadImage } from '@/lib/upload'

type AdminPromo = NonNullable<Awaited<ReturnType<typeof getAdminState>>['promo']>
type AdminOffer = AdminPromo['offers'][number]

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.')
const firstIssue = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues[0]?.message ?? 'Please check the form.'

/** datetime-local works in the device's time zone; the server stores UTC. */
const toLocal = (d: Date | string | null) => {
  if (!d) return ''
  const t = new Date(d)
  return new Date(t.getTime() - t.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null)
const when = (d: Date | string) =>
  new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const int = (v: string) => (v.trim() === '' ? null : Math.round(Number(v.replace(/[^\d.]/g, ''))))

const STATE_TONE: Record<OfferState, string> = {
  active: 'bg-whatsapp/15 text-whatsapp-ink',
  scheduled: 'bg-gold-soft/60 text-ink',
  paused: 'bg-sand text-muted',
  expired: 'bg-red-50 text-red-700',
  used_up: 'bg-red-50 text-red-700',
}

function Pill({ state }: { state: OfferState }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATE_TONE[state]}`}>{OFFER_STATE_LABEL[state]}</span>
}

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-sand bg-ivory p-5">
      <h2 className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-muted">
        {icon} {title}
      </h2>
      <div className="mt-4">{children}</div>
    </div>
  )
}

function Field({ label, hint, error, children, className = '' }: { label: string; hint?: string; error?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block text-xs text-muted ${className}`}>
      <span className={error ? 'text-red-700' : ''}>{label}</span>
      {hint && <span className="text-muted/70"> · {hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  )
}

function Check({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 accent-plum" />
      <span>
        {label}
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  )
}

/* ---------------- Tab ---------------- */

export function OffersTab({ promo, categories, items }: { promo: AdminPromo; categories: Category[]; items: Item[] }) {
  const [editing, setEditing] = useState<AdminOffer | 'new' | null>(null)
  const active = promo.offers.filter((o) => o.state === 'active')
  const scheduled = promo.offers.filter((o) => o.state === 'scheduled')
  const t = promo.totals
  const freeLive = freeDeliveryLive(promo.delivery.free)

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-plum">Offers &amp; Discounts</h1>
          <p className="text-sm text-muted">Festive sales, coupon codes and free delivery · changes go live instantly</p>
        </div>
        <button onClick={() => setEditing('new')} className="flex items-center gap-2 rounded-full bg-plum px-5 py-2.5 text-sm font-medium text-ivory transition hover:bg-ink active:scale-95">
          <Plus className="size-4" /> New offer
        </button>
      </div>

      <section aria-label="Promotion performance" className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Stat label="Active offers" value={String(active.length)} />
        <Stat label="Scheduled" value={String(scheduled.length)} />
        <Stat label="Orders with promotions" value={String(t.promoOrders)} />
        <Stat label="Discount granted" value={formatPrice(t.discount)} />
        <Stat label="Free-delivery orders" value={String(t.freeDeliveryOrders)} />
        <Stat label="Delivery fees waived" value={formatPrice(t.deliveryWaived)} />
        <Stat label="Promotion revenue" value={formatPrice(t.revenue)} />
      </section>
      <p className="mt-2 text-xs text-muted">Counts every order except cancelled and payment-rejected ones.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section>
          {promo.offers.length === 0 ? (
            <div className="grid place-items-center rounded-lg border border-dashed border-sand bg-ivory py-16 text-center">
              <Gift className="size-8 text-gold" />
              <p className="mt-3 font-display text-2xl text-plum">No offers yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted">Create a Dashain or Tihar sale that applies automatically, or a coupon code like TIHAR15.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {promo.offers.map((o) => (
                <OfferRow key={o.id} offer={o} categories={categories} onEdit={() => setEditing(o)} />
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-6">
          <DeliveryCard settings={promo.delivery} live={freeLive} categories={categories} items={items} />
          <AuditCard log={promo.log} />
        </aside>
      </div>

      {editing && <OfferEditor offer={editing === 'new' ? null : editing} categories={categories} items={items} onClose={() => setEditing(null)} />}
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-sand bg-ivory p-3">
      <p className="text-[0.65rem] uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function conditions(o: AdminOffer, categories: Category[]) {
  const cat = new Map(categories.map((c) => [c.id, c.name]))
  return [
    o.scope === 'all' ? 'All pieces' : o.scope === 'products' ? `${o.productIds.length} selected piece${o.productIds.length === 1 ? '' : 's'}` : o.categoryIds.map((id) => cat.get(id) ?? 'Deleted category').join(', '),
    o.minPurchase > 0 && `min. ${formatPrice(o.minPurchase)}`,
    o.maxDiscount != null && `max ${formatPrice(o.maxDiscount)} off`,
    o.excludeSale && 'not on sale pieces',
    o.excludeProductIds.length > 0 && `${o.excludeProductIds.length} excluded`,
    o.perCustomerLimit != null && `${o.perCustomerLimit}× per customer`,
    o.totalLimit != null && `${o.stats.orders}/${o.totalLimit} uses`,
    o.kind === 'coupon' && (o.stackable ? 'combines with automatic offers' : 'not combinable'),
  ].filter(Boolean) as string[]
}

function OfferRow({ offer: o, categories, onEdit }: { offer: AdminOffer; categories: Category[]; onEdit: () => void }) {
  const router = useRouter()
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  async function run(kind: string, fn: () => Promise<unknown>) {
    setBusy(kind)
    setError('')
    try {
      await fn()
      await router.invalidate()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy('')
    }
  }

  return (
    <li className={`rounded-lg border border-sand bg-ivory p-4 ${o.state === 'paused' || o.state === 'expired' ? 'opacity-75' : ''}`}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{o.name}</span>
            <Pill state={o.state} />
            {o.kind === 'coupon' ? (
              <span className="flex items-center gap-1 rounded border border-dashed border-plum/40 px-2 py-0.5 text-xs font-semibold tracking-[0.12em]">
                <Tag className="size-3" /> {o.code}
              </span>
            ) : (
              <span className="rounded bg-cream px-2 py-0.5 text-xs text-muted">Automatic</span>
            )}
          </p>
          <p className="mt-1 text-sm">
            <span className="font-semibold text-sale">{discountLabel(o)}</span>
            <span className="text-muted"> · {conditions(o, categories).join(' · ')}</span>
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
            <CalendarClock className="size-3.5" />
            {o.startsAt ? when(o.startsAt) : 'Now'} → {o.endsAt ? when(o.endsAt) : 'No end date'}
            {o.showBanner && ' · Banner on'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => run('toggle', () => setOfferActive({ data: { id: o.id, active: !o.active } }))}
            disabled={!!busy}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${o.active ? 'border-sand hover:border-gold' : 'border-plum bg-plum text-ivory'}`}
          >
            {busy === 'toggle' ? <Loader2 className="size-3.5 animate-spin" /> : o.active ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            {o.active ? 'Pause' : 'Activate'}
          </button>
          <button onClick={onEdit} className="rounded-full p-2 text-muted hover:bg-cream hover:text-plum" aria-label={`Edit ${o.name}`}>
            <Pencil className="size-4" />
          </button>
          <button
            onClick={() =>
              confirm(`Delete “${o.name}”? Past orders keep their discount record. To stop it temporarily, use Pause instead.`) &&
              run('delete', () => deleteOffer({ data: { id: o.id } }))
            }
            disabled={!!busy}
            className="rounded-full p-2 text-muted hover:bg-red-50 hover:text-red-700"
            aria-label={`Delete ${o.name}`}
          >
            {busy === 'delete' ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          </button>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-sand pt-3 text-xs">
        <div><dt className="text-muted">Orders</dt><dd className="font-semibold">{o.stats.orders}</dd></div>
        <div><dt className="text-muted">Discount given</dt><dd className="font-semibold">{formatPrice(o.stats.discount)}</dd></div>
        <div><dt className="text-muted">Sales</dt><dd className="font-semibold">{formatPrice(o.stats.revenue)}</dd></div>
      </dl>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </li>
  )
}

/* ---------------- Offer editor ---------------- */

type Form = {
  name: string
  kind: 'automatic' | 'coupon'
  code: string
  discountType: 'percent' | 'fixed'
  discountValue: string
  minPurchase: string
  maxDiscount: string
  startsAt: string
  endsAt: string
  active: boolean
  scope: 'all' | 'products' | 'categories'
  productIds: number[]
  categoryIds: number[]
  excludeProductIds: number[]
  excludeSale: boolean
  perCustomerLimit: string
  totalLimit: string
  stackable: boolean
  showBanner: boolean
  bannerTitle: string
  bannerText: string
  bannerImage: string
  ctaText: string
  announcement: string
  showCountdown: boolean
  cartMessage: string
}

const asForm = (o: AdminOffer | null): Form => ({
  name: o?.name ?? '',
  kind: (o?.kind as Form['kind']) ?? 'automatic',
  code: o?.code ?? '',
  discountType: (o?.discountType as Form['discountType']) ?? 'percent',
  discountValue: o ? String(o.discountValue) : '',
  minPurchase: o?.minPurchase ? String(o.minPurchase) : '',
  maxDiscount: o?.maxDiscount != null ? String(o.maxDiscount) : '',
  startsAt: toLocal(o?.startsAt ?? null),
  endsAt: toLocal(o?.endsAt ?? null),
  active: o?.active ?? true,
  scope: (o?.scope as Form['scope']) ?? 'all',
  productIds: o?.productIds ?? [],
  categoryIds: o?.categoryIds ?? [],
  excludeProductIds: o?.excludeProductIds ?? [],
  excludeSale: o?.excludeSale ?? false,
  perCustomerLimit: o?.perCustomerLimit != null ? String(o.perCustomerLimit) : '',
  totalLimit: o?.totalLimit != null ? String(o.totalLimit) : '',
  stackable: o?.stackable ?? false,
  showBanner: o?.showBanner ?? false,
  bannerTitle: o?.bannerTitle ?? '',
  bannerText: o?.bannerText ?? '',
  bannerImage: o?.bannerImage ?? '',
  ctaText: o?.ctaText ?? '',
  announcement: o?.announcement ?? '',
  showCountdown: o?.showCountdown ?? false,
  cartMessage: o?.cartMessage ?? '',
})

function OfferEditor({ offer, categories, items, onClose }: { offer: AdminOffer | null; categories: Category[]; items: Item[]; onClose: () => void }) {
  const router = useRouter()
  const [f, setF] = useState<Form>(() => asForm(offer))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }))
  const text = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(k, e.target.value as never)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const input = {
      ...f,
      id: offer?.id,
      discountValue: int(f.discountValue) ?? 0,
      minPurchase: int(f.minPurchase) ?? 0,
      maxDiscount: int(f.maxDiscount),
      perCustomerLimit: int(f.perCustomerLimit),
      totalLimit: int(f.totalLimit),
      startsAt: fromLocal(f.startsAt),
      endsAt: fromLocal(f.endsAt),
    }
    const parsed = offerInputSchema.safeParse(input)
    if (!parsed.success) return setError(firstIssue(parsed))
    setSaving(true)
    setError('')
    try {
      await saveOffer({ data: parsed.data })
      await router.invalidate()
      onClose()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setSaving(false)
    }
  }

  async function upload(file: File | undefined) {
    if (!file) return
    setUploading(true)
    try {
      set('bannerImage', await uploadImage(file, { crop: false }))
    } catch (err) {
      setError(errorText(err))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40" onClick={onClose}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-2xl flex-col bg-ivory shadow-2xl">
        <div className="flex items-center justify-between border-b border-sand px-6 py-4">
          <h2 className="font-display text-2xl text-plum">{offer ? 'Edit offer' : 'New offer'}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-cream" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <Section title="Offer">
            <Field label="Festival / campaign name">
              <input value={f.name} onChange={text('name')} className="field text-sm" placeholder="e.g. Dashain Sale, Tihar Offer, Year-End Sale" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="How it applies">
                <select value={f.kind} onChange={text('kind')} className="field text-sm">
                  <option value="automatic">Automatically to eligible bags</option>
                  <option value="coupon">Only with a coupon code</option>
                </select>
              </Field>
              {f.kind === 'coupon' && (
                <Field label="Coupon code" hint="customers can type it in any case">
                  <input value={f.code} onChange={(e) => set('code', e.target.value.toUpperCase().replace(/\s/g, ''))} className="field text-sm font-semibold tracking-[0.12em]" placeholder="TIHAR15" />
                </Field>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Discount type">
                <select value={f.discountType} onChange={text('discountType')} className="field text-sm">
                  <option value="percent">Percentage (%)</option>
                  <option value="fixed">Fixed amount (Rs.)</option>
                </select>
              </Field>
              <Field label={f.discountType === 'percent' ? 'Discount (%)' : 'Discount (Rs.)'}>
                <input inputMode="numeric" value={f.discountValue} onChange={text('discountValue')} className="field text-sm" placeholder={f.discountType === 'percent' ? '15' : '200'} />
              </Field>
              {f.discountType === 'percent' && (
                <Field label="Max discount (Rs.)" hint="optional">
                  <input inputMode="numeric" value={f.maxDiscount} onChange={text('maxDiscount')} className="field text-sm" placeholder="No cap" />
                </Field>
              )}
            </div>
            <Field label="Minimum purchase (Rs.)" hint="of eligible pieces, after sale prices">
              <input inputMode="numeric" value={f.minPurchase} onChange={text('minPurchase')} className="field text-sm" placeholder="0 = no minimum" />
            </Field>
            {f.kind === 'coupon' && (
              <Check on={f.stackable} onChange={(v) => set('stackable', v)} label="Can be combined with automatic offers" hint="Off: the customer gets whichever discount is bigger." />
            )}
          </Section>

          <Section title="Schedule">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Starts" hint="empty = now">
                <input type="datetime-local" value={f.startsAt} onChange={text('startsAt')} className="field text-sm" />
              </Field>
              <Field label="Ends" hint="empty = no end">
                <input type="datetime-local" value={f.endsAt} onChange={text('endsAt')} className="field text-sm" />
              </Field>
            </div>
            <p className="text-xs text-muted">Times are in this device’s time zone. Expired offers hide themselves automatically.</p>
            <Check on={f.active} onChange={(v) => set('active', v)} label="Enabled" hint="Untick to pause the offer without deleting it." />
          </Section>

          <Section title="Eligible pieces">
            <div className="flex flex-wrap gap-2">
              {(['all', 'categories', 'products'] as const).map((s) => (
                <Chip key={s} on={f.scope === s} onClick={() => set('scope', s)} label={s === 'all' ? 'All products' : s === 'categories' ? 'Selected categories' : 'Selected products'} />
              ))}
            </div>
            {f.scope === 'categories' && <CategoryPicker categories={categories} value={f.categoryIds} onChange={(v) => set('categoryIds', v)} />}
            {f.scope === 'products' && <ProductPicker items={items} value={f.productIds} onChange={(v) => set('productIds', v)} />}
            <Check on={f.excludeSale} onChange={(v) => set('excludeSale', v)} label="Exclude pieces already on sale" hint="Pieces with a crossed-out price or in Clearance won’t get this discount." />
            <details className="rounded-md border border-sand bg-white p-3" open={f.excludeProductIds.length > 0}>
              <summary className="cursor-pointer text-sm">Exclude specific products {f.excludeProductIds.length > 0 && `(${f.excludeProductIds.length})`}</summary>
              <div className="mt-3">
                <ProductPicker items={items} value={f.excludeProductIds} onChange={(v) => set('excludeProductIds', v)} />
              </div>
            </details>
          </Section>

          <Section title="Usage limits">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Uses per customer" hint="by mobile number">
                <input inputMode="numeric" value={f.perCustomerLimit} onChange={text('perCustomerLimit')} className="field text-sm" placeholder="Unlimited" />
              </Field>
              <Field label="Total uses for the campaign">
                <input inputMode="numeric" value={f.totalLimit} onChange={text('totalLimit')} className="field text-sm" placeholder="Unlimited" />
              </Field>
            </div>
            <p className="text-xs text-muted">Cancelled and payment-rejected orders don’t count towards the limits.</p>
          </Section>

          <Section title="Marketing">
            <Check on={f.showBanner} onChange={(v) => set('showBanner', v)} label="Show a festive banner on the home and shop pages" hint={f.kind === 'coupon' ? 'The banner shows the coupon code to everyone.' : 'Shown as “Coming soon” before the start date.'} />
            {f.showBanner && (
              <>
                <Field label="Banner headline" hint="empty = generated">
                  <input value={f.bannerTitle} onChange={text('bannerTitle')} className="field text-sm" placeholder={`${f.name || 'Festive Fashion Sale'} at Aura Luxe!`} />
                </Field>
                <Field label="Banner text" hint="empty = generated from the offer">
                  <textarea rows={2} value={f.bannerText} onChange={text('bannerText')} className="field resize-y text-sm" placeholder="Enjoy {discount} and FREE DELIVERY on orders over {free_delivery_min}. Shop your favourite styles today!" />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Button text">
                    <input value={f.ctaText} onChange={text('ctaText')} className="field text-sm" placeholder="Shop the Festive Collection" />
                  </Field>
                  <div className="flex items-end pb-1">
                    <Check on={f.showCountdown} onChange={(v) => set('showCountdown', v)} label="Countdown to the end date" />
                  </div>
                </div>
                <div className="text-xs text-muted">
                  Banner image <span className="text-muted/70">· optional, wide photos work best</span>
                  <div className="mt-1 flex items-center gap-3">
                    <div className="grid h-20 w-32 shrink-0 place-items-center overflow-hidden rounded border border-sand bg-white">
                      {uploading ? <Loader2 className="size-5 animate-spin" /> : f.bannerImage ? <img src={cdn(f.bannerImage, 300)} alt="" className="size-full object-cover" /> : <ImagePlus className="size-6 text-sand" />}
                    </div>
                    <label className="cursor-pointer rounded-full border border-sand px-3 py-1 text-sm text-ink hover:border-gold">
                      {f.bannerImage ? 'Replace' : 'Upload'}
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = '' }} />
                    </label>
                    {f.bannerImage && <button type="button" onClick={() => set('bannerImage', '')} className="text-xs text-red-700">Remove</button>}
                  </div>
                </div>
              </>
            )}
            <Field label="Announcement bar" hint="top of every page while live; empty = none">
              <input value={f.announcement} onChange={text('announcement')} className="field text-sm" placeholder="Dashain Sale: {discount} everything · ends {ends}" />
            </Field>
            <Field label="Bag & checkout message" hint="optional">
              <input value={f.cartMessage} onChange={text('cartMessage')} className="field text-sm" placeholder="Spend {min} to get {discount} this Tihar!" />
            </Field>
            <p className="text-xs text-muted">
              Placeholders fill in live values: <code>{'{discount}'}</code> <code>{'{code}'}</code> <code>{'{min}'}</code> <code>{'{max}'}</code> <code>{'{ends}'}</code> <code>{'{free_delivery_min}'}</code>
            </p>
          </Section>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-sand px-6 py-4">
          <p className="text-sm text-red-700">{error}</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm text-muted hover:text-plum">Cancel</button>
            <button disabled={saving || uploading} className="flex items-center gap-2 rounded-full bg-plum px-6 py-2 text-sm text-ivory disabled:opacity-60">
              {saving && <Loader2 className="size-4 animate-spin" />} Save offer
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-xs uppercase tracking-[0.2em] text-muted">{title}</legend>
      {children}
    </fieldset>
  )
}

function Chip({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-full border px-3 py-1 text-xs transition ${on ? 'border-plum bg-plum text-ivory' : 'border-sand bg-white hover:border-gold'}`}>
      {label}
    </button>
  )
}

const toggleId = (list: number[], id: number) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

function CategoryPicker({ categories, value, onChange }: { categories: Category[]; value: number[]; onChange: (v: number[]) => void }) {
  if (!categories.length) return <p className="text-xs text-muted">No categories yet — add them on the Pieces tab.</p>
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((c) => (
        <Chip key={c.id} on={value.includes(c.id)} onClick={() => onChange(toggleId(value, c.id))} label={c.name} />
      ))}
    </div>
  )
}

function ProductPicker({ items, value, onChange }: { items: Item[]; value: number[]; onChange: (v: number[]) => void }) {
  const [q, setQ] = useState('')
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return items.filter((i) => !s || i.name.toLowerCase().includes(s))
  }, [items, q])
  return (
    <div className="rounded-md border border-sand bg-white">
      <div className="flex items-center gap-2 border-b border-sand px-3">
        <Search className="size-4 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${items.length} pieces`} className="h-10 flex-1 bg-transparent text-sm outline-none" />
        <span className="text-xs text-muted">{value.length} selected</span>
      </div>
      <ul className="max-h-56 overflow-y-auto">
        {shown.map((i) => (
          <li key={i.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-1.5 text-sm hover:bg-cream">
              <input type="checkbox" checked={value.includes(i.id)} onChange={() => onChange(toggleId(value, i.id))} className="size-4 accent-plum" />
              <span className="size-8 shrink-0 overflow-hidden rounded bg-cream">{i.images[0] && <img src={cdn(i.images[0], 80)} alt="" className="size-full object-cover" />}</span>
              <span className="min-w-0 flex-1 truncate">{i.name}</span>
              <span className="text-xs text-muted">{formatPrice(i.price)}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ---------------- Delivery & free delivery ---------------- */

type ZoneForm = { id: string; name: string; cities: string; charge: string }

function DeliveryCard({ settings, live, categories, items }: { settings: AdminPromo['delivery']; live: boolean; categories: Category[]; items: Item[] }) {
  const router = useRouter()
  const [base, setBase] = useState(String(settings.baseCharge))
  const [zones, setZones] = useState<ZoneForm[]>(settings.zones.map((z) => ({ id: z.id, name: z.name, cities: z.cities.join(', '), charge: String(z.charge) })))
  const [free, setFree] = useState({ ...settings.free, min: String(settings.free.min), startsAt: toLocal(settings.free.startsAt), endsAt: toLocal(settings.free.endsAt) })
  const [status, setStatus] = useState<{ ok?: boolean; msg?: string; busy?: boolean }>({})
  const setFreeKey = <K extends keyof typeof free>(k: K, v: (typeof free)[K]) => setFree((p) => ({ ...p, [k]: v }))
  const setZone = (i: number, patch: Partial<ZoneForm>) => setZones((zs) => zs.map((z, n) => (n === i ? { ...z, ...patch } : z)))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const input = {
      baseCharge: int(base) ?? 0,
      zones: zones.map((z) => ({ id: z.id, name: z.name.trim(), cities: z.cities.split(',').map((c) => c.trim()).filter(Boolean), charge: int(z.charge) ?? 0 })),
      free: { ...free, min: int(free.min) ?? 0, startsAt: fromLocal(free.startsAt), endsAt: fromLocal(free.endsAt) },
    }
    const parsed = deliveryInputSchema.safeParse(input)
    if (!parsed.success) return setStatus({ msg: firstIssue(parsed) })
    setStatus({ busy: true })
    try {
      await saveDeliverySettings({ data: parsed.data })
      setStatus({ ok: true, msg: 'Saved — the shop is updated' })
      await router.invalidate()
    } catch (err) {
      setStatus({ msg: errorText(err) })
    }
  }

  const zoneChoices = [...zones.filter((z) => z.name.trim()).map((z) => ({ id: z.id, name: z.name })), { id: DEFAULT_ZONE, name: zones.length ? 'Everywhere else' : 'All cities' }]

  return (
    <Card title="Delivery & free delivery" icon={<Truck className="size-4" />}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Standard delivery charge (Rs.)" hint="cities not in a zone">
          <input inputMode="numeric" value={base} onChange={(e) => setBase(e.target.value)} className="field text-sm" placeholder="100" />
        </Field>

        <div>
          <p className="text-xs text-muted">Delivery zones <span className="text-muted/70">· optional, matched to the city the customer types</span></p>
          <ul className="mt-2 space-y-2">
            {zones.map((z, i) => (
              <li key={z.id} className="space-y-2 rounded-md border border-sand bg-white p-3">
                <div className="flex gap-2">
                  <input value={z.name} onChange={(e) => setZone(i, { name: e.target.value })} className="field flex-1 text-sm" placeholder="Zone name, e.g. Kathmandu Valley" />
                  <input inputMode="numeric" value={z.charge} onChange={(e) => setZone(i, { charge: e.target.value })} className="field w-20 text-sm" placeholder="Rs." aria-label="Charge" />
                  <button type="button" onClick={() => setZones((zs) => zs.filter((_, n) => n !== i))} className="rounded-full p-2 text-muted hover:text-red-700" aria-label="Remove zone">
                    <X className="size-4" />
                  </button>
                </div>
                <textarea rows={2} value={z.cities} onChange={(e) => setZone(i, { cities: e.target.value })} className="field resize-y text-sm" placeholder="Cities, comma separated: Kathmandu, Lalitpur, Bhaktapur, Patan, KTM" />
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setZones((zs) => [...zs, { id: `z-${crypto.randomUUID().slice(0, 8)}`, name: '', cities: '', charge: '' }])} className="mt-2 flex items-center gap-1 text-xs font-medium text-plum hover:underline">
            <Plus className="size-3.5" /> Add zone
          </button>
        </div>

        <div className="space-y-3 rounded-md border border-gold-soft bg-white p-3">
          <div className="flex items-center justify-between">
            <Check on={free.enabled} onChange={(v) => setFreeKey('enabled', v)} label="Free delivery above a minimum order" />
            {free.enabled && <span className={`rounded-full px-2 py-0.5 text-xs ${live ? 'bg-whatsapp/15 text-whatsapp-ink' : 'bg-gold-soft/60'}`}>{live ? 'Live' : 'Not live now'}</span>}
          </div>
          {free.enabled && (
            <>
              <Field label="Minimum order (Rs.)" hint="after discounts">
                <input inputMode="numeric" value={free.min} onChange={(e) => setFreeKey('min', e.target.value)} className="field text-sm" placeholder="2000" />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="From" hint="optional">
                  <input type="datetime-local" value={free.startsAt} onChange={(e) => setFreeKey('startsAt', e.target.value)} className="field text-xs" />
                </Field>
                <Field label="Until" hint="optional">
                  <input type="datetime-local" value={free.endsAt} onChange={(e) => setFreeKey('endsAt', e.target.value)} className="field text-xs" />
                </Field>
              </div>
              <div>
                <p className="text-xs text-muted">Counts towards the minimum</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {(['all', 'categories', 'products'] as const).map((s) => (
                    <Chip key={s} on={free.scope === s} onClick={() => setFreeKey('scope', s)} label={s === 'all' ? 'All pieces' : s === 'categories' ? 'Categories' : 'Products'} />
                  ))}
                </div>
                {free.scope === 'categories' && <div className="mt-2"><CategoryPicker categories={categories} value={free.categoryIds} onChange={(v) => setFreeKey('categoryIds', v)} /></div>}
                {free.scope === 'products' && <div className="mt-2"><ProductPicker items={items} value={free.productIds} onChange={(v) => setFreeKey('productIds', v)} /></div>}
              </div>
              <div>
                <p className="text-xs text-muted">Where it applies <span className="text-muted/70">· none selected = everywhere</span></p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {zoneChoices.map((z) => (
                    <Chip key={z.id} on={free.zoneIds.includes(z.id)} onClick={() => setFreeKey('zoneIds', free.zoneIds.includes(z.id) ? free.zoneIds.filter((x) => x !== z.id) : [...free.zoneIds, z.id])} label={z.name} />
                  ))}
                </div>
              </div>
              <Check on={free.announce} onChange={(v) => setFreeKey('announce', v)} label="Announce in the bar at the top of the shop" />
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className={`text-xs ${status.ok ? 'text-whatsapp-ink' : 'text-red-700'}`}>{status.msg}</p>
          <button disabled={status.busy} className="rounded-full bg-plum px-4 py-1.5 text-sm text-ivory disabled:opacity-60">Save</button>
        </div>
      </form>
    </Card>
  )
}

/* ---------------- Audit log ---------------- */

function AuditCard({ log }: { log: AdminPromo['log'] }) {
  return (
    <Card title="Change history" icon={<History className="size-4" />}>
      {log.length === 0 ? (
        <p className="text-sm text-muted">Changes to offers and delivery settings appear here.</p>
      ) : (
        <ul className="max-h-96 space-y-2.5 overflow-y-auto text-sm">
          {log.map((e) => {
            const { fields } = e
            return (
              <li key={e.id} className="border-b border-sand pb-2 last:border-0">
                <p>{e.summary}</p>
                <p className="text-xs text-muted">
                  {when(e.createdAt)}
                  {fields.length > 0 && ` · changed ${fields.join(', ')}`}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
