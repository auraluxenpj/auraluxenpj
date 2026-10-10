import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { AlertCircle, ArrowLeft, Check, Copy, Download, FileText, Landmark, Loader2, Lock, QrCode, RefreshCw, ShoppingBag, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { SiteLayout } from '@/components/SiteChrome'
import { Wrap } from '@/components/Section'
import { cdn, formatPrice, whatsappLink } from '@/lib/format'
import { FREE_SIZE } from '@/lib/catalog'
import { PROOF_TYPES, checkoutSchema } from '@/lib/orders'
import type { Quote } from '@/lib/pricing'
import { useSite } from '@/lib/site'
import { bag, placedOrders, qtyOf } from '@/lib/store'
import { prepareProof } from '@/lib/upload'
import { getCartQuote, getCheckoutSettings } from '@/server/orders.functions'

export const Route = createFileRoute('/checkout')({
  head: () => ({ meta: [{ title: 'Checkout — Aura Luxe' }, { name: 'robots', content: 'noindex' }] }),
  loader: () => getCheckoutSettings(),
  component: CheckoutPage,
})

type Customer = { name: string; phone: string; email: string; address: string; city: string; area: string; landmark: string }
const EMPTY: Customer = { name: '', phone: '', email: '', address: '', city: '', area: '', landmark: '' }
const KEY_STORAGE = 'auraluxe:checkout-key'
const TIMEOUT_MS = 60_000

/** One key per checkout attempt, kept across reloads/retries so the server never creates a second order. */
function checkoutKey() {
  let key = sessionStorage.getItem(KEY_STORAGE)
  if (!key) {
    key = crypto.randomUUID()
    sessionStorage.setItem(KEY_STORAGE, key)
  }
  return key
}

function CheckoutPage() {
  const pay = Route.useLoaderData()
  const { whatsapp } = useSite()
  const router = useRouter()
  const entries = bag.use()
  const lines = useMemo(() => entries.map((e) => ({ id: e.id, size: e.size, colour: e.colour, qty: qtyOf(e) })), [entries])
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteError, setQuoteError] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const [reload, setReload] = useState(0)
  const [customer, setCustomer] = useState<Customer>(EMPTY)
  const [transactionId, setTransactionId] = useState('')
  const [paymentDate, setPaymentDate] = useState('')
  const [proof, setProof] = useState<File | null>(null)
  const [proofError, setProofError] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const busy = useRef(false)

  useEffect(() => setHydrated(true), [])

  const linesKey = JSON.stringify(lines)
  useEffect(() => {
    if (!hydrated || !lines.length) return
    let live = true
    setQuoteError('')
    getCartQuote({ data: { lines } })
      .then((q) => live && setQuote(q))
      .catch(() => live && setQuoteError('We couldn’t load the latest prices and stock. Check your connection and try again.'))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, linesKey, reload])

  const set = (k: keyof Customer) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setCustomer((c) => ({ ...c, [k]: e.target.value }))
    if (errors[k]) setErrors(({ [k]: _, ...rest }) => rest)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy.current) return
    setSubmitError('')
    const parsed = checkoutSchema.safeParse({
      idempotencyKey: checkoutKey(),
      customer,
      paymentMethod: 'bank_transfer',
      transactionId,
      paymentDate,
      lines,
    })
    const fieldErrors: Record<string, string> = {}
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] === 'customer' ? String(issue.path[1]) : String(issue.path[0])
        fieldErrors[key] ??= issue.message
      }
    }
    if (!proof) fieldErrors.proof = 'Upload your payment screenshot or receipt.'
    if (Object.keys(fieldErrors).length || !parsed.success) {
      setErrors(fieldErrors)
      const first = ['name', 'phone', 'email', 'address', 'city', 'area', 'landmark', 'proof', 'transactionId', 'paymentDate', 'lines'].find((k) => fieldErrors[k])
      document.getElementById(`f-${first}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      if (fieldErrors.lines) setSubmitError(fieldErrors.lines)
      return
    }
    if (quote && !quote.ok) return setSubmitError('Some pieces in your bag need attention — please go back to your bag.')

    busy.current = true
    setSubmitting(true)
    const body = new FormData()
    body.append('order', JSON.stringify(parsed.data))
    body.append('proof', proof!)
    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), TIMEOUT_MS)
    try {
      const res = await fetch('/api/orders', { method: 'POST', body, signal: abort.signal })
      const json = (await res.json().catch(() => ({}))) as { number?: string; token?: string; error?: string }
      if (!res.ok || !json.number || !json.token) {
        setSubmitError(
          json.error ??
            (res.status === 413
              ? 'Your payment proof is too large to send. Please upload a smaller screenshot.'
              : 'We could not place your order right now. Please try again in a moment.'),
        )
        // Stock may have changed — refresh the summary so the customer sees what to fix
        if (res.status === 409) getCartQuote({ data: { lines } }).then(setQuote).catch(() => {})
        return
      }
      placedOrders.set((list) => [{ number: json.number!, token: json.token!, at: new Date().toISOString() }, ...list.filter((o) => o.number !== json.number)].slice(0, 20))
      bag.set([])
      sessionStorage.removeItem(KEY_STORAGE)
      await router.navigate({ to: '/order/$number', params: { number: json.number }, search: { t: json.token }, replace: true })
    } catch (err) {
      setSubmitError(
        (err as Error)?.name === 'AbortError'
          ? 'This is taking longer than usual. Please check your connection and tap Place Order again — you won’t be charged or ordered twice.'
          : 'Network problem — please check your connection and tap Place Order again. Retrying won’t create a duplicate order.',
      )
    } finally {
      clearTimeout(timer)
      busy.current = false
      setSubmitting(false)
    }
  }

  if (!hydrated) {
    return (
      <SiteLayout>
        <Wrap className="grid min-h-[50vh] place-items-center">
          <Loader2 className="size-6 animate-spin text-muted" />
        </Wrap>
      </SiteLayout>
    )
  }

  if (!lines.length) {
    return (
      <SiteLayout>
        <Wrap className="grid min-h-[50vh] place-items-center py-16 text-center">
          <div>
            <ShoppingBag className="mx-auto size-7 text-gold-deep" strokeWidth={1.5} />
            <h1 className="mt-4 font-display text-3xl">Your bag is empty</h1>
            <p className="mt-2 text-sm text-muted">Add a piece in your size to check out.</p>
            <Link to="/shop" search={{}} className="btn btn-dark mt-6">Browse the collection</Link>
          </div>
        </Wrap>
      </SiteLayout>
    )
  }

  if (!pay.open) {
    return (
      <SiteLayout>
        <Wrap className="grid min-h-[50vh] place-items-center py-16 text-center">
          <div className="max-w-md">
            <h1 className="font-display text-3xl">Online checkout is coming soon</h1>
            <p className="mt-2 text-sm text-muted">For now, send your bag to us on WhatsApp and we’ll confirm stock and payment there.</p>
            <Link to="/bag" className="btn btn-dark mt-6">Back to your bag</Link>
          </div>
        </Wrap>
      </SiteLayout>
    )
  }

  const total = quote?.total ?? 0

  return (
    <SiteLayout chatHref={whatsappLink(whatsapp, 'Hi Aura Luxe 👋\nI need help with my order at checkout.')}>
      <Wrap className="pt-4 md:pt-8">
        <Link to="/bag" className="inline-flex h-10 items-center gap-2 text-sm text-muted transition hover:text-ink">
          <ArrowLeft className="size-4" /> Back to bag
        </Link>
        <h1 className="mt-1 font-display text-3xl tracking-[0.06em] uppercase sm:text-4xl">Checkout</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
          <Lock className="size-3.5" /> Pay by bank transfer or QR, upload your proof, and we’ll verify and confirm.
        </p>
      </Wrap>

      <form onSubmit={submit} noValidate>
        <Wrap className="mt-6 grid gap-6 pb-10 lg:grid-cols-[1fr_24rem] lg:items-start lg:gap-10">
          <div className="space-y-6">
            {/* 1 · Customer */}
            <Step n={1} title="Delivery details">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input id="name" label="Full Name" required value={customer.name} onChange={set('name')} error={errors.name} autoComplete="name" />
                <Input id="phone" label="Mobile Number" required value={customer.phone} onChange={set('phone')} error={errors.phone} autoComplete="tel" inputMode="tel" placeholder="98XXXXXXXX" />
                <Input id="email" label="Email" hint="Optional" value={customer.email} onChange={set('email')} error={errors.email} autoComplete="email" inputMode="email" type="email" className="sm:col-span-2" />
                <Input id="address" label="Address" required value={customer.address} onChange={set('address')} error={errors.address} autoComplete="street-address" placeholder="House / street" className="sm:col-span-2" />
                <Input id="city" label="City" required value={customer.city} onChange={set('city')} error={errors.city} autoComplete="address-level2" placeholder="e.g. Kathmandu" />
                <Input id="area" label="Area / Locality" required value={customer.area} onChange={set('area')} error={errors.area} autoComplete="address-level3" placeholder="e.g. Baneshwor" />
                <Input id="landmark" label="Landmark" hint="Optional" value={customer.landmark} onChange={set('landmark')} error={errors.landmark} placeholder="Near…" className="sm:col-span-2" />
              </div>
            </Step>

            {/* 2 · Payment */}
            <Step n={2} title="Payment method">
              <div className="flex items-center gap-3 rounded-md border-2 border-ink bg-white px-4 py-3">
                <span className="grid size-5 place-items-center rounded-full border-2 border-ink">
                  <span className="size-2.5 rounded-full bg-ink" />
                </span>
                <span className="text-sm font-medium">Bank Transfer / QR Payment</span>
              </div>

              <div className="mt-5 rounded-lg border border-gold-soft bg-gradient-to-b from-blush/60 to-white p-5">
                <p className="eyebrow">Pay to Aura Luxe</p>
                <p className="mt-2 flex items-baseline justify-between gap-3 border-b border-sand pb-3">
                  <span className="text-sm text-muted">Amount to Pay</span>
                  <span className="font-display text-3xl text-ink">{quote ? formatPrice(total) : '…'}</span>
                </p>

                <div className={`mt-4 grid gap-6 ${pay.qr && pay.accountNumber ? 'md:grid-cols-2' : ''}`}>
                  {pay.qr && (
                    <div className="text-center">
                      <p className="flex items-center justify-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.16em]">
                        <QrCode className="size-4" /> Scan QR to Pay
                      </p>
                      <img src={pay.qr} alt="Aura Luxe payment QR code" className="mx-auto mt-3 aspect-square w-full max-w-[18rem] rounded-md border border-sand bg-white object-contain p-2" />
                      <a href={pay.qr} download="auraluxe-payment-qr.jpg" className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-xs font-medium underline-offset-4 hover:underline">
                        <Download className="size-3.5" /> Save QR to scan from your gallery
                      </a>
                    </div>
                  )}
                  {(pay.bankName || pay.accountNumber) && (
                    <div>
                      <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.16em]">
                        <Landmark className="size-4" /> Bank Transfer
                      </p>
                      <dl className="mt-3 space-y-2.5 text-sm">
                        <BankRow label="Bank Name" value={pay.bankName} />
                        <BankRow label="Account Name" value={pay.accountName} />
                        <BankRow label="Account Number" value={pay.accountNumber} copy />
                        <BankRow label="Branch" value={pay.branch} />
                      </dl>
                    </div>
                  )}
                </div>
                {pay.instructions && <p className="mt-5 whitespace-pre-line border-t border-sand pt-4 text-sm leading-relaxed text-muted">{pay.instructions}</p>}
              </div>
            </Step>

            {/* 3 · Proof */}
            <Step n={3} title="Upload payment proof">
              <ProofPicker
                file={proof}
                maxBytes={pay.proofMaxBytes}
                error={errors.proof || proofError}
                onChange={(f) => {
                  setProof(f)
                  setProofError('')
                  setErrors(({ proof: _, ...rest }) => rest)
                }}
                onError={setProofError}
              />
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Input id="transactionId" label="Transaction ID / Reference Number" hint="Optional" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} error={errors.transactionId} />
                <Input id="paymentDate" label="Payment Date" hint="Optional" type="date" value={paymentDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setPaymentDate(e.target.value)} error={errors.paymentDate} />
              </div>
            </Step>
          </div>

          {/* Summary */}
          <aside className="rounded-lg border border-sand bg-white p-5 lg:sticky lg:top-24">
            <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em]">Order summary</h2>
            {quoteError && (
              <p className="mt-3 flex gap-1.5 text-sm text-sale">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>
                  {quoteError}{' '}
                  <button type="button" onClick={() => setReload((n) => n + 1)} className="font-medium underline underline-offset-4">
                    Try again
                  </button>
                </span>
              </p>
            )}
            {!quote && !quoteError && <Loader2 className="mx-auto my-8 size-5 animate-spin text-muted" />}
            {quote && (
              <>
                <ul className="mt-3 divide-y divide-sand">
                  {quote.lines.map((l, i) => (
                    <li key={i} className="flex gap-3 py-3">
                      <div className="aspect-[4/5] w-14 shrink-0 overflow-hidden rounded bg-cream">
                        {l.image && <img src={cdn(l.image, 120)} alt="" className="size-full object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="font-medium">{l.name}</p>
                        <p className="text-xs text-muted">
                          {l.sizeLabel === FREE_SIZE ? 'Free Size' : `Size ${l.sizeLabel || '—'}`}
                          {l.colour ? ` · ${l.colour}` : ''} · Qty {l.qty}
                        </p>
                        <p className="text-xs text-muted">
                          {formatPrice(l.unitPrice)} × {l.qty}
                        </p>
                        {l.error && <p className="mt-1 text-xs font-medium text-sale">{l.error}</p>}
                      </div>
                      <p className="text-sm font-medium">{formatPrice(l.lineTotal)}</p>
                    </li>
                  ))}
                </ul>
                <dl className="space-y-2 border-t border-sand pt-3 text-sm">
                  <Row label="Subtotal" value={formatPrice(quote.subtotal)} />
                  <Row label="Delivery" value={quote.deliveryCharge ? formatPrice(quote.deliveryCharge) : 'Free'} />
                  <Row label="Discount" value={quote.discount ? `− ${formatPrice(quote.discount)}` : formatPrice(0)} tone={quote.discount ? 'text-sale' : undefined} />
                  <div className="flex items-baseline justify-between border-t border-sand pt-3">
                    <dt className="font-medium">Total</dt>
                    <dd className="text-xl font-semibold">{formatPrice(quote.total)}</dd>
                  </div>
                </dl>
                {!quote.ok && (
                  <Link to="/bag" className="mt-3 block text-sm font-medium text-sale underline underline-offset-4">
                    Some pieces need attention — review your bag
                  </Link>
                )}
              </>
            )}

            {submitError && (
              <p role="alert" className="mt-4 flex gap-1.5 rounded-md bg-sale/10 p-3 text-sm text-sale">
                <AlertCircle className="mt-0.5 size-4 shrink-0" /> {submitError}
              </p>
            )}
            <button type="submit" disabled={submitting || !quote?.ok} className="btn btn-dark mt-5 min-h-13 w-full text-[0.85rem] disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Placing order…
                </>
              ) : (
                <>Place Order{quote ? ` · ${formatPrice(total)}` : ''}</>
              )}
            </button>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Your order is confirmed once our team verifies your payment. Pieces are reserved for you while we check.
            </p>
          </aside>
        </Wrap>
      </form>
    </SiteLayout>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-sand bg-white p-5 sm:p-6">
      <h2 className="flex items-center gap-3 font-display text-xl">
        <span className="grid size-7 place-items-center rounded-full bg-ink font-sans text-xs font-semibold text-white">{n}</span>
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function Input({
  id,
  label,
  hint,
  error,
  required,
  className = '',
  ...props
}: { id: string; label: string; hint?: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label id={`f-${id}`} className={`block ${className}`}>
      <span className="text-xs font-medium text-ink">
        {label}
        {required && <span className="text-sale"> *</span>}
        {hint && <span className="font-normal text-muted"> · {hint}</span>}
      </span>
      <input
        {...props}
        name={id}
        aria-invalid={Boolean(error)}
        aria-required={required}
        className={`field mt-1.5 min-h-12 ${error ? 'border-sale!' : ''}`}
      />
      {error && <span className="mt-1 block text-xs text-sale">{error}</span>}
    </label>
  )
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`flex justify-between ${tone ?? ''}`}>
      <dt className={tone ? '' : 'text-muted'}>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function BankRow({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  const [copied, setCopied] = useState(false)
  if (!value) return null
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-white/70 px-3 py-2">
      <dt className="text-muted">{label}</dt>
      <dd className="flex items-center gap-1 text-right font-medium">
        <span className={copy ? 'tabular-nums tracking-wide' : ''}>{value}</span>
        {copy && (
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })}
            className="-my-2 grid size-10 place-items-center text-muted hover:text-ink"
            aria-label={`Copy ${label}`}
          >
            {copied ? <Check className="size-4 text-whatsapp-ink" /> : <Copy className="size-4" />}
          </button>
        )}
      </dd>
    </div>
  )
}

const ACCEPT = Object.keys(PROOF_TYPES).join(',')

function ProofPicker({
  file,
  maxBytes,
  error,
  onChange,
  onError,
}: {
  file: File | null
  maxBytes: number
  error?: string
  onChange: (f: File | null) => void
  onError: (msg: string) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const maxMb = Math.round(maxBytes / 1024 / 1024)

  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) return setPreview(null)
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  async function pick(f: File | undefined) {
    if (!f) return
    const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    const typeOk = PROOF_TYPES[f.type] || ['jpg', 'jpeg', 'png', 'pdf'].includes(ext)
    if (!typeOk) return onError('Please upload a JPG, PNG or PDF file.')
    setWorking(true)
    try {
      const ready = await prepareProof(f)
      if (ready.size > maxBytes) return onError(`This file is larger than ${maxMb} MB. Please upload a smaller screenshot.`)
      onChange(ready)
    } catch {
      onError('We couldn’t read that file. Please try another screenshot.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <div id="f-proof">
      <p className="text-xs font-medium">
        Payment Screenshot / Transaction Proof <span className="text-sale">*</span>
      </p>
      <input ref={input} type="file" accept={`${ACCEPT},.jpg,.jpeg,.png,.pdf`} className="sr-only" tabIndex={-1} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
      {file ? (
        <div className="mt-2 flex items-center gap-4 rounded-md border border-sand bg-cream/50 p-3">
          <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded bg-white">
            {preview ? <img src={preview} alt="Payment proof preview" className="size-full object-cover" /> : <FileText className="size-8 text-muted" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-medium text-whatsapp-ink">
              <Check className="size-4" /> Proof attached
            </p>
            <p className="truncate text-xs text-muted">
              {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
            </p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => input.current?.click()} className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-sand bg-white px-3 text-xs font-medium hover:border-ink">
                <RefreshCw className="size-3.5" /> Replace
              </button>
              <button type="button" onClick={() => onChange(null)} className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-muted hover:text-sale">
                <X className="size-3.5" /> Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={working}
          className={`mt-2 flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed bg-cream/40 px-4 py-6 text-center transition hover:border-ink ${error ? 'border-sale' : 'border-sand'}`}
        >
          {working ? <Loader2 className="size-6 animate-spin text-muted" /> : <Upload className="size-6 text-gold-deep" />}
          <span className="text-sm font-semibold uppercase tracking-[0.12em]">Upload Payment Proof</span>
          <span className="text-xs text-muted">JPG, PNG or PDF · up to {maxMb} MB</span>
        </button>
      )}
      {error && <p className="mt-1.5 text-xs text-sale">{error}</p>}
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
        <Lock className="size-3" /> Stored privately — only the Aura Luxe team can see it.
      </p>
    </div>
  )
}
