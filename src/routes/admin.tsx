import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import {
  Check,
  ExternalLink,
  Gift,
  Eye,
  EyeOff,
  ImagePlus,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Package,
  Phone,
  QrCode,
  ShieldCheck,
  ShieldX,
  Pencil,
  Plus,
  Star,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Category, Item } from '../../db/schema'
import type { StoreInfo } from '@/server/catalog.server'
import type { PaymentSettings } from '@/server/orders.server'
import { getAdminOrder, saveOrderNotes, savePaymentSettings, updateOrderStatus } from '@/server/orders.functions'
import { ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUS_LABEL, PROOF_MAX_MB_LIMIT, statusLabel } from '@/lib/orders'
import type { OrderStatus } from '@/lib/orders'
import {
  addCategory,
  changePassword,
  deleteCategory,
  deleteItem,
  getAdminState,
  login,
  logout,
  renameCategory,
  requestPasswordReset,
  resetPassword,
  saveItem,
  saveRecoveryEmail,
  saveStoreInfo,
  saveWhatsapp,
  setupPassword,
} from '@/server/catalog.functions'
import { cdn, discountPercent, formatPhone, formatPrice } from '@/lib/format'
import { FREE_SIZE, OCCASIONS, isSoldOut, sizeKeys, sortSizes, stockOf } from '@/lib/catalog'
import { uploadImage } from '@/lib/upload'
import { WhatsAppIcon } from '@/components/WhatsAppIcon'
import { OffersTab } from '@/components/OffersAdmin'
import { PriceBreakdown, orderBreakdown } from '@/components/Promo'

type AdminSearch = { reset?: string; tab?: 'orders' | 'offers' }

export const Route = createFileRoute('/admin')({
  validateSearch: (search: Record<string, unknown>): AdminSearch => ({
    reset: typeof search.reset === 'string' ? search.reset : undefined,
    tab: search.tab === 'orders' || search.tab === 'offers' ? search.tab : undefined,
  }),
  head: () => ({ meta: [{ title: 'Shop admin — AuraLuxe' }, { name: 'robots', content: 'noindex' }] }),
  loader: () => getAdminState(),
  component: AdminPage,
})

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.')

function AdminPage() {
  const state = Route.useLoaderData()
  const { reset } = Route.useSearch()
  if (reset && state.hasPassword) return <ResetScreen token={reset} />
  if (!state.loggedIn || !state.catalog) return <AuthScreen setup={!state.hasPassword} recoveryHint={state.recoveryEmail} />
  return <Dashboard catalog={state.catalog} recoveryEmail={state.recoveryEmail} orders={state.orders} payment={state.payment!} promo={state.promo!} />
}

/* ---------------- Auth ---------------- */

function AuthScreen({ setup, recoveryHint }: { setup: boolean; recoveryHint: string }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  async function forgot() {
    if (!confirm(`Email a password reset link to ${recoveryHint}?`)) return
    setError('')
    setNotice('')
    setBusy(true)
    try {
      const { sentTo } = await requestPasswordReset()
      setNotice(`Reset link sent to ${sentTo}. It expires in 30 minutes.`)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (setup && password !== repeat) return setError('Passwords do not match.')
    setBusy(true)
    try {
      if (setup) await setupPassword({ data: { password } })
      else await login({ data: { password } })
      await router.invalidate()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-cream px-5">
      <form onSubmit={submit} className="rise w-full max-w-sm bg-ivory p-8 shadow-[0_30px_60px_-30px_rgba(74,36,51,0.35)]">
        <p className="font-display text-3xl text-plum">
          AURA<span className="text-gold">·</span>LUXE
        </p>
        <h1 className="mt-5 text-lg font-medium">{setup ? 'Create your admin password' : 'Shop admin'}</h1>
        <p className="mt-1 text-sm text-muted">
          {setup
            ? 'This is the first visit. Choose a password to protect your catalog.'
            : 'Log in to manage pieces, photos and your WhatsApp number.'}
        </p>
        <label className="mt-6 block text-xs uppercase tracking-[0.2em] text-muted">
          Password
          <input type="password" autoFocus required minLength={setup ? 6 : 1} value={password} onChange={(e) => setPassword(e.target.value)} className="field mt-2 normal-case tracking-normal" />
        </label>
        {setup && (
          <label className="mt-4 block text-xs uppercase tracking-[0.2em] text-muted">
            Repeat password
            <input type="password" required value={repeat} onChange={(e) => setRepeat(e.target.value)} className="field mt-2 normal-case tracking-normal" />
          </label>
        )}
        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
        {notice && <p className="mt-4 text-sm text-whatsapp-ink">{notice}</p>}
        <button disabled={busy} className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-plum py-3 text-sm font-medium text-ivory transition hover:bg-ink disabled:opacity-60">
          {busy && <Loader2 className="size-4 animate-spin" />} {setup ? 'Create password' : 'Log in'}
        </button>
        {!setup && (
          <button type="button" disabled={busy} onClick={forgot} className="mt-4 block w-full text-center text-sm text-plum hover:text-gold disabled:opacity-60">
            Forgot password?
          </button>
        )}
        <Link to="/" className="mt-5 block text-center text-sm text-muted hover:text-plum">
          ← Back to the shop
        </Link>
      </form>
    </div>
  )
}

function ResetScreen({ token }: { token: string }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== repeat) return setError('Passwords do not match.')
    setBusy(true)
    try {
      await resetPassword({ data: { token, password } })
      await router.navigate({ to: '/admin', search: {} })
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-cream px-5">
      <form onSubmit={submit} className="rise w-full max-w-sm bg-ivory p-8 shadow-[0_30px_60px_-30px_rgba(74,36,51,0.35)]">
        <p className="font-display text-3xl text-plum">
          AURA<span className="text-gold">·</span>LUXE
        </p>
        <h1 className="mt-5 text-lg font-medium">Choose a new password</h1>
        <p className="mt-1 text-sm text-muted">Every device signed in with the old password will be signed out.</p>
        <label className="mt-6 block text-xs uppercase tracking-[0.2em] text-muted">
          New password
          <input type="password" autoFocus required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="field mt-2 normal-case tracking-normal" />
        </label>
        <label className="mt-4 block text-xs uppercase tracking-[0.2em] text-muted">
          Repeat password
          <input type="password" required value={repeat} onChange={(e) => setRepeat(e.target.value)} className="field mt-2 normal-case tracking-normal" />
        </label>
        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
        <button disabled={busy} className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-plum py-3 text-sm font-medium text-ivory transition hover:bg-ink disabled:opacity-60">
          {busy && <Loader2 className="size-4 animate-spin" />} Save new password
        </button>
        <Link to="/admin" search={{}} className="mt-5 block text-center text-sm text-muted hover:text-plum">
          ← Back to log in
        </Link>
      </form>
    </div>
  )
}

/* ---------------- Dashboard ---------------- */

type Catalog = { categories: Category[]; items: Item[]; whatsapp: string; store: StoreInfo }

type OrderRow = Awaited<ReturnType<typeof getAdminState>>['orders'][number]

type Promo = NonNullable<Awaited<ReturnType<typeof getAdminState>>['promo']>

function Dashboard({ catalog, recoveryEmail, orders, payment, promo }: { catalog: Catalog; recoveryEmail: string; orders: OrderRow[]; payment: PaymentSettings; promo: Promo }) {
  const router = useRouter()
  const { tab } = Route.useSearch()
  const toReview = orders.filter((o) => o.status === 'payment_verification').length
  const [editing, setEditing] = useState<Item | 'new' | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const catName = new Map(catalog.categories.map((c) => [c.id, c.name]))

  async function signOut() {
    await logout()
    await router.invalidate()
  }

  return (
    <div className="min-h-screen bg-cream/60">
      <header className="sticky top-0 z-40 border-b border-sand bg-ivory/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <p className="font-display text-2xl text-plum">
            AURA<span className="text-gold">·</span>LUXE <span className="ml-1 font-sans text-xs uppercase tracking-[0.25em] text-muted">Admin</span>
          </p>
          <div className="flex items-center gap-1 text-sm">
            <Link to="/" target="_blank" className="flex items-center gap-1.5 rounded-full px-3 py-2 text-muted hover:text-plum">
              <ExternalLink className="size-4" /> <span className="hidden sm:inline">View shop</span>
            </Link>
            <button onClick={() => setShowPassword(true)} className="flex items-center gap-1.5 rounded-full px-3 py-2 text-muted hover:text-plum">
              <KeyRound className="size-4" /> <span className="hidden sm:inline">Password</span>
            </button>
            <button onClick={signOut} className="flex items-center gap-1.5 rounded-full px-3 py-2 text-muted hover:text-plum">
              <LogOut className="size-4" /> <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>
      </header>

      <nav className="mx-auto flex max-w-6xl gap-1 px-5 pt-6" aria-label="Admin sections">
        <Link to="/admin" search={{}} className={`rounded-full px-5 py-2 text-sm transition ${!tab ? 'bg-plum text-ivory' : 'text-muted hover:text-plum'}`}>
          Pieces
        </Link>
        <Link to="/admin" search={{ tab: 'orders' }} className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm transition ${tab === 'orders' ? 'bg-plum text-ivory' : 'text-muted hover:text-plum'}`}>
          <Package className="size-4" /> Orders
          {toReview > 0 && <span className="rounded-full bg-gold px-1.5 text-[0.65rem] font-semibold text-ink">{toReview}</span>}
        </Link>
        <Link to="/admin" search={{ tab: 'offers' }} className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm transition ${tab === 'offers' ? 'bg-plum text-ivory' : 'text-muted hover:text-plum'}`}>
          <Gift className="size-4" /> <span className="hidden sm:inline">Offers &amp; Discounts</span><span className="sm:hidden">Offers</span>
        </Link>
      </nav>

      {tab === 'orders' ? (
        <OrdersTab orders={orders} payment={payment} />
      ) : tab === 'offers' ? (
        <OffersTab promo={promo} categories={catalog.categories} items={catalog.items} />
      ) : (
      <main className="mx-auto grid max-w-6xl gap-6 px-5 py-8 lg:grid-cols-[1fr_20rem]">
        <section className="order-2 lg:order-1">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h1 className="font-display text-4xl text-plum">Pieces</h1>
              <p className="text-sm text-muted">{catalog.items.length} in the catalog · changes go live instantly</p>
            </div>
            <button onClick={() => setEditing('new')} className="flex items-center gap-2 rounded-full bg-plum px-5 py-2.5 text-sm font-medium text-ivory transition hover:bg-ink active:scale-95">
              <Plus className="size-4" /> Add piece
            </button>
          </div>

          {catalog.items.length === 0 ? (
            <div className="grid place-items-center rounded-lg border border-dashed border-sand bg-ivory py-20 text-center">
              <ImagePlus className="size-8 text-gold" />
              <p className="mt-3 font-display text-2xl text-plum">Your catalog is empty</p>
              <p className="mt-1 text-sm text-muted">Add your first piece with photos, price and sizes.</p>
            </div>
          ) : (
            <ul className="divide-y divide-sand overflow-hidden rounded-lg border border-sand bg-ivory">
              {catalog.items.map((item) => (
                <li key={item.id} className={`flex items-center gap-4 p-3 ${item.published ? '' : 'opacity-60'}`}>
                  <div className="size-16 shrink-0 overflow-hidden rounded bg-cream">
                    {item.images[0] && <img src={cdn(item.images[0], 160)} alt="" className="size-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate font-medium">
                      {item.featured && <Star className="size-3.5 shrink-0 fill-gold text-gold" />}
                      {item.clearance && <Tag className="size-3.5 shrink-0 text-plum" />}
                      {item.name}
                    </p>
                    <p className="truncate text-sm text-muted">
                      {item.categoryId ? catName.get(item.categoryId) : 'Other'} · {formatPrice(item.price)} · {item.images.length} photo
                      {item.images.length === 1 ? '' : 's'}
                      {' · '}
                      {isSoldOut(item) ? (
                        <span className="text-red-700">Out of stock</span>
                      ) : (
                        `${sizeKeys(item).reduce((n, k) => n + stockOf(item, k), 0)} in stock`
                      )}
                      {item.clearance && ' · Clearance'}
                      {!item.published && ' · Hidden'}
                    </p>
                  </div>
                  <button onClick={() => setEditing(item)} className="rounded-full p-2 text-muted hover:bg-cream hover:text-plum" aria-label={`Edit ${item.name}`}>
                    <Pencil className="size-4" />
                  </button>
                  <DeleteItemButton item={item} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="order-1 space-y-6 lg:order-2">
          <WhatsappCard number={catalog.whatsapp} />
          <StoreInfoCard store={catalog.store} />
          <RecoveryEmailCard email={recoveryEmail} />
          <CategoriesCard categories={catalog.categories} items={catalog.items} />
        </aside>
      </main>
      )}

      {editing && (
        <ItemEditor
          item={editing === 'new' ? null : editing}
          categories={catalog.categories}
          items={catalog.items}
          onClose={() => setEditing(null)}
        />
      )}
      {showPassword && <PasswordDialog onClose={() => setShowPassword(false)} />}
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-sand bg-ivory p-5">
      <h2 className="text-xs uppercase tracking-[0.25em] text-muted">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  )
}

function WhatsappCard({ number }: { number: string }) {
  const router = useRouter()
  const [value, setValue] = useState(formatPhone(number))
  const [status, setStatus] = useState<{ ok?: boolean; msg?: string; busy?: boolean }>({})

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setStatus({ busy: true })
    try {
      const { whatsapp } = await saveWhatsapp({ data: { number: value } })
      setValue(formatPhone(whatsapp))
      setStatus({ ok: true, msg: 'Saved' })
      await router.invalidate()
    } catch (err) {
      setStatus({ msg: errorText(err) })
    }
  }

  return (
    <Card title="WhatsApp number">
      <form onSubmit={save} className="space-y-3">
        <div className="relative">
          <WhatsAppIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-whatsapp-ink" />
          <input value={value} onChange={(e) => setValue(e.target.value)} className="field pl-9!" placeholder="+977 97XXXXXXXX" />
        </div>
        <div className="flex items-center justify-between">
          <p className={`text-xs ${status.ok ? 'text-whatsapp-ink' : 'text-red-700'}`}>{status.msg}</p>
          <button disabled={status.busy} className="rounded-full bg-plum px-4 py-1.5 text-sm text-ivory disabled:opacity-60">
            Save
          </button>
        </div>
        <p className="text-xs text-muted">Every Enquire button opens a chat with this number.</p>
      </form>
    </Card>
  )
}

const STORE_FIELDS = [
  { key: 'store_address', label: 'Store address', placeholder: 'Street, area, city', multiline: true },
  { key: 'store_hours', label: 'Opening hours', placeholder: 'e.g. Sun–Fri 10am–7pm', multiline: true },
  { key: 'store_phone', label: 'Store phone', placeholder: '+977 …' },
  { key: 'store_map_url', label: 'Google Maps link', placeholder: 'https://maps.app.goo.gl/…' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/…' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@…' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/…' },
] as const

function StoreInfoCard({ store }: { store: StoreInfo }) {
  const router = useRouter()
  const [values, setValues] = useState(store)
  const [status, setStatus] = useState<{ ok?: boolean; msg?: string; busy?: boolean }>({})

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setStatus({ busy: true })
    try {
      setValues(await saveStoreInfo({ data: values }))
      setStatus({ ok: true, msg: 'Saved' })
      await router.invalidate()
    } catch (err) {
      setStatus({ msg: errorText(err) })
    }
  }

  return (
    <Card title="Store & social links">
      <form onSubmit={save} className="space-y-3">
        {STORE_FIELDS.map((f) => (
          <label key={f.key} className="block text-xs text-muted">
            {f.label}
            {'multiline' in f ? (
              <textarea rows={2} value={values[f.key]} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} className="field mt-1 resize-y text-sm" placeholder={f.placeholder} />
            ) : (
              <input value={values[f.key]} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} className="field mt-1 text-sm" placeholder={f.placeholder} />
            )}
          </label>
        ))}
        <div className="flex items-center justify-between">
          <p className={`text-xs ${status.ok ? 'text-whatsapp-ink' : 'text-red-700'}`}>{status.msg}</p>
          <button disabled={status.busy} className="rounded-full bg-plum px-4 py-1.5 text-sm text-ivory disabled:opacity-60">
            Save
          </button>
        </div>
        <p className="flex gap-1.5 text-xs text-muted">
          <MapPin className="size-3.5 shrink-0" /> Shown in “Visit Aura Luxe” and the footer. Empty fields stay hidden; social links enable “Follow the Aura”.
        </p>
      </form>
    </Card>
  )
}

function RecoveryEmailCard({ email }: { email: string }) {
  const router = useRouter()
  const [value, setValue] = useState(email)
  const [status, setStatus] = useState<{ ok?: boolean; msg?: string; busy?: boolean }>({})

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setStatus({ busy: true })
    try {
      const saved = await saveRecoveryEmail({ data: { email: value } })
      setValue(saved.email)
      setStatus({ ok: true, msg: 'Saved' })
      await router.invalidate()
    } catch (err) {
      setStatus({ msg: errorText(err) })
    }
  }

  return (
    <Card title="Recovery email">
      <form onSubmit={save} className="space-y-3">
        <div className="relative">
          <Mail className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gold" />
          <input type="email" required value={value} onChange={(e) => setValue(e.target.value)} className="field pl-9!" placeholder="you@example.com" />
        </div>
        <div className="flex items-center justify-between">
          <p className={`text-xs ${status.ok ? 'text-whatsapp-ink' : 'text-red-700'}`}>{status.msg}</p>
          <button disabled={status.busy} className="rounded-full bg-plum px-4 py-1.5 text-sm text-ivory disabled:opacity-60">
            Save
          </button>
        </div>
        <p className="text-xs text-muted">“Forgot password?” sends a reset link to this address.</p>
      </form>
    </Card>
  )
}

function CategoriesCard({ categories, items }: { categories: Category[]; items: Item[] }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [error, setError] = useState('')

  const run = async (fn: () => Promise<unknown>) => {
    setError('')
    try {
      await fn()
      await router.invalidate()
    } catch (err) {
      setError(errorText(err))
    }
  }

  return (
    <Card title="Categories">
      <ul className="space-y-1">
        {categories.map((c) => {
          const count = items.filter((i) => i.categoryId === c.id).length
          return (
            <li key={c.id} className="group flex items-center gap-2 rounded px-2 py-1.5 hover:bg-cream">
              {editId === c.id ? (
                <form
                  className="flex flex-1 gap-1"
                  onSubmit={(e) => {
                    e.preventDefault()
                    run(() => renameCategory({ data: { id: c.id, name: editName } })).then(() => setEditId(null))
                  }}
                >
                  <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} className="field py-1! text-sm" />
                  <button className="p-1 text-whatsapp-ink" aria-label="Save">
                    <Check className="size-4" />
                  </button>
                </form>
              ) : (
                <>
                  <span className="flex-1 text-sm">{c.name}</span>
                  <span className="text-xs text-muted">{count}</span>
                  <button onClick={() => { setEditId(c.id); setEditName(c.name) }} className="p-1 text-muted opacity-0 group-hover:opacity-100 hover:text-plum max-lg:opacity-100" aria-label={`Rename ${c.name}`}>
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      const note = count ? ` Its ${count} piece${count === 1 ? '' : 's'} will move to “Other”.` : ''
                      if (confirm(`Remove the “${c.name}” category?${note}`)) run(() => deleteCategory({ data: { id: c.id } }))
                    }}
                    className="p-1 text-muted opacity-0 group-hover:opacity-100 hover:text-red-700 max-lg:opacity-100"
                    aria-label={`Remove ${c.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </>
              )}
            </li>
          )
        })}
      </ul>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) run(() => addCategory({ data: { name } })).then(() => setName(''))
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category" className="field py-1.5! text-sm" />
        <button className="rounded-full border border-sand px-3 text-sm hover:border-gold" aria-label="Add category">
          <Plus className="size-4" />
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </Card>
  )
}

function DeleteItemButton({ item }: { item: Item }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return (
    <button
      disabled={busy}
      onClick={async () => {
        if (!confirm(`Delete “${item.name}” and its photos? This cannot be undone.`)) return
        setBusy(true)
        await deleteItem({ data: { id: item.id } }).catch((e) => alert(errorText(e)))
        await router.invalidate()
        setBusy(false)
      }}
      className="rounded-full p-2 text-muted hover:bg-cream hover:text-red-700"
      aria-label={`Delete ${item.name}`}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </button>
  )
}

/* ---------------- Item editor ---------------- */

const splitList = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

const parseRupees = (s: string) => (s.trim() ? Math.round(Number(s.replace(/[^\d.]/g, ''))) : null)

function ItemEditor({ item, categories, items, onClose }: { item: Item | null; categories: Category[]; items: Item[]; onClose: () => void }) {
  const router = useRouter()
  const [name, setName] = useState(item?.name ?? '')
  const [categoryId, setCategoryId] = useState<string>(item?.categoryId ? String(item.categoryId) : categories[0] ? String(categories[0].id) : '')
  const [price, setPrice] = useState(item?.price != null ? String(item.price) : '')
  const [comparePrice, setComparePrice] = useState(item?.comparePrice != null ? String(item.comparePrice) : '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [sizes, setSizes] = useState(item?.sizes.join(', ') ?? '')
  const [colors, setColors] = useState(item?.colors.join(', ') ?? '')
  const [images, setImages] = useState<string[]>(item?.images ?? [])
  const [featured, setFeatured] = useState(item?.featured ?? false)
  const [published, setPublished] = useState(item?.published ?? true)
  const [clearance, setClearance] = useState(item?.clearance ?? false)
  const [fabric, setFabric] = useState(item?.fabric ?? '')
  const [pattern, setPattern] = useState(item?.pattern ?? '')
  const [fit, setFit] = useState(item?.fit ?? '')
  const [setContents, setSetContents] = useState(item?.setContents ?? '')
  const [occasions, setOccasions] = useState<string[]>(item?.occasions ?? [])
  const [badge, setBadge] = useState<'' | 'new' | 'bestseller' | 'trending'>((item?.badge as '' | 'new' | 'bestseller' | 'trending') ?? '')
  const [stock, setStock] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(item?.stock ?? {}).map(([k, v]) => [k, String(v)])),
  )
  const [lookIds, setLookIds] = useState<number[]>(item?.lookIds ?? [])
  const sizeList = splitList(sizes)
  const stockKeys = sizeList.length ? sortSizes(sizeList) : [FREE_SIZE]
  const sellPrice = parseRupees(price)
  const wasPrice = parseRupees(comparePrice)
  const toggleIn = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const [uploading, setUploading] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function addFiles(files: FileList | null) {
    if (!files?.length) return
    setError('')
    const room = 8 - images.length
    const picked = Array.from(files).slice(0, room)
    if (files.length > room) setError('Up to 8 photos per piece — extra photos were skipped.')
    setUploading((n) => n + picked.length)
    await Promise.all(
      picked.map(async (file) => {
        try {
          const src = await uploadImage(file)
          setImages((prev) => [...prev, src])
        } catch (err) {
          setError(errorText(err))
        } finally {
          setUploading((n) => n - 1)
        }
      }),
    )
  }

  const move = (i: number, d: number) =>
    setImages((prev) => {
      const next = [...prev]
      const j = i + d
      if (j < 0 || j >= next.length) return prev
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await saveItem({
        data: {
          id: item?.id,
          name,
          categoryId: categoryId ? Number(categoryId) : null,
          price: parseRupees(price),
          comparePrice: parseRupees(comparePrice),
          description,
          sizes: splitList(sizes),
          colors: splitList(colors),
          images,
          featured,
          published,
          clearance,
          fabric,
          pattern,
          fit,
          setContents,
          occasions,
          badge,
          stock: Object.fromEntries(stockKeys.map((k) => [k, Math.max(0, Math.floor(Number(stock[k]) || 0))])),
          stockBefore: item ? item.stock : undefined,
          lookIds,
        },
      })
      await router.invalidate()
      onClose()
    } catch (err) {
      setError(errorText(err))
      setSaving(false)
    }
  }

  return (
    <div className="fade fixed inset-0 z-[70] flex justify-end bg-ink/40 backdrop-blur-sm" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-xl flex-col bg-ivory shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-sand px-6 py-4">
          <h2 className="font-display text-3xl text-plum">{item ? 'Edit piece' : 'New piece'}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-muted hover:bg-cream" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          <div>
            <Label>Photos <span className="normal-case tracking-normal">({images.length}/8 · first photo is the cover · auto-cropped to 4:5)</span></Label>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {images.map((src, i) => (
                <div key={src} className="group relative aspect-[4/5] overflow-hidden rounded bg-cream">
                  <img src={cdn(src, 240)} alt="" className="size-full object-cover" />
                  {i === 0 && <span className="absolute top-1 left-1 bg-ivory/90 px-1.5 text-[0.6rem] uppercase tracking-wider text-plum">Cover</span>}
                  <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-ink/70 p-1 opacity-0 transition group-hover:opacity-100 max-md:opacity-100">
                    <button type="button" onClick={() => move(i, -1)} className="px-1 text-ivory" aria-label="Move earlier">‹</button>
                    <button type="button" onClick={() => setImages((p) => p.filter((x) => x !== src))} className="text-ivory" aria-label="Remove photo">
                      <Trash2 className="size-3.5" />
                    </button>
                    <button type="button" onClick={() => move(i, 1)} className="px-1 text-ivory" aria-label="Move later">›</button>
                  </div>
                </div>
              ))}
              {Array.from({ length: uploading }).map((_, i) => (
                <div key={`u${i}`} className="grid aspect-[4/5] animate-pulse place-items-center rounded bg-sand/60">
                  <Loader2 className="size-5 animate-spin text-muted" />
                </div>
              ))}
              {images.length + uploading < 8 && (
                <label className="grid aspect-[4/5] cursor-pointer place-items-center rounded border-2 border-dashed border-sand text-muted transition hover:border-gold hover:text-plum">
                  <span className="flex flex-col items-center gap-1 text-xs">
                    <ImagePlus className="size-5" /> Add
                  </span>
                  <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
                </label>
              )}
            </div>
          </div>

          <Field label="Name">
            <input required value={name} onChange={(e) => setName(e.target.value)} className="field" placeholder="e.g. Ivory Chikankari Kurta Set" />
          </Field>

          <Field label="Category">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="field">
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value="">Other</option>
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Price (Rs.)">
              <input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} className="field" placeholder="Leave blank for “on request”" />
            </Field>
            <Field label="Crossed-out price (Rs.)" hint="Optional · sets the discount">
              <input inputMode="numeric" value={comparePrice} onChange={(e) => setComparePrice(e.target.value)} className="field" placeholder="Original price, e.g. 32000" />
            </Field>
          </div>
          {sellPrice != null && wasPrice != null && wasPrice > sellPrice && (
            <p className="-mt-3 text-xs text-whatsapp-ink">Customers see {discountPercent(sellPrice, wasPrice)}% off · Rs. {(wasPrice - sellPrice).toLocaleString('en-IN')} discount per piece</p>
          )}

          <Field label="Description">
            <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className="field resize-y" placeholder="Fabric, work, occasion, what's included…" />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Sizes" hint="Comma separated · blank = Free Size">
              <input value={sizes} onChange={(e) => setSizes(e.target.value)} className="field" placeholder="S, M, L, XL" />
            </Field>
            <Field label="Colours" hint="Comma separated">
              <input value={colors} onChange={(e) => setColors(e.target.value)} className="field" placeholder="Ivory, Blush" />
            </Field>
          </div>

          <div>
            <Label>
              Stock per size{' '}
              <span className="normal-case tracking-normal">
                · {sizeList.length ? '0 shows the size as Out of Stock' : 'no sizes listed, so this piece is Free Size'} · online orders deduct automatically
              </span>
            </Label>
            <div className="mt-2 overflow-hidden rounded-lg border border-sand bg-white">
              <table className="w-full text-sm">
                <thead className="bg-cream/70 text-left text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Size</th>
                    <th className="px-3 py-2 text-right font-medium">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand">
                  {stockKeys.map((k) => {
                    const n = Number(stock[k]) || 0
                    return (
                      <tr key={k}>
                        <td className="px-3 py-1.5">
                          {k}
                          {n <= 0 && <span className="ml-2 text-xs text-red-700">Out of Stock</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <input
                            inputMode="numeric"
                            value={stock[k] ?? ''}
                            onChange={(e) => setStock({ ...stock, [k]: e.target.value.replace(/\D/g, '') })}
                            placeholder="0"
                            aria-label={`Stock for ${k}`}
                            className="field w-24! py-1.5! text-right"
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Fabric" hint="Optional">
              <input value={fabric} onChange={(e) => setFabric(e.target.value)} className="field" placeholder="e.g. Cotton" />
            </Field>
            <Field label="Pattern / work" hint="Optional">
              <input value={pattern} onChange={(e) => setPattern(e.target.value)} className="field" placeholder="e.g. Chikankari" />
            </Field>
            <Field label="Set contents" hint="Optional">
              <input value={setContents} onChange={(e) => setSetContents(e.target.value)} className="field" placeholder="e.g. Kurta, pant & dupatta" />
            </Field>
            <Field label="Fit" hint="Optional">
              <input value={fit} onChange={(e) => setFit(e.target.value)} className="field" placeholder="e.g. Straight, relaxed" />
            </Field>
          </div>

          <div>
            <Label>Occasions <span className="normal-case tracking-normal">· used for filters and “How would you wear it?”</span></Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {OCCASIONS.map((o) => (
                <button key={o} type="button" onClick={() => setOccasions(toggleIn(occasions, o))} className={`rounded-full border px-3 py-1 text-sm ${occasions.includes(o) ? 'border-plum bg-plum text-ivory' : 'border-sand'}`}>
                  {o}
                </button>
              ))}
            </div>
          </div>

          <Field label="Badge" hint="SALE shows automatically for crossed-out prices & clearance">
            <select value={badge} onChange={(e) => setBadge(e.target.value as typeof badge)} className="field">
              <option value="">None</option>
              <option value="new">New</option>
              <option value="bestseller">Bestseller</option>
              <option value="trending">Trending</option>
            </select>
          </Field>

          {items.some((o) => o.id !== item?.id) && (
            <div>
              <Label>Complete the look <span className="normal-case tracking-normal">· up to 4 pieces to style with this one ({lookIds.length}/4)</span></Label>
              <div className="mt-2 grid max-h-52 grid-cols-2 gap-2 overflow-y-auto">
                {items
                  .filter((o) => o.id !== item?.id)
                  .map((o) => {
                    const on = lookIds.includes(o.id)
                    return (
                      <button
                        key={o.id}
                        type="button"
                        disabled={!on && lookIds.length >= 4}
                        onClick={() => setLookIds(toggleIn(lookIds, o.id))}
                        className={`flex items-center gap-2 rounded border p-1.5 text-left text-xs disabled:opacity-40 ${on ? 'border-plum bg-cream' : 'border-sand'}`}
                      >
                        <span className="size-9 shrink-0 overflow-hidden rounded bg-cream">
                          {o.images[0] && <img src={cdn(o.images[0], 80)} alt="" className="size-full object-cover" />}
                        </span>
                        <span className="line-clamp-2 flex-1">{o.name}</span>
                        {on && <Check className="size-3.5 shrink-0" />}
                      </button>
                    )
                  })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Toggle on={featured} onClick={() => setFeatured(!featured)} icon={<Star className="size-4" />} label="Featured" hint="Shown first and in Trending Now" />
            <Toggle on={published} onClick={() => setPublished(!published)} icon={published ? <Eye className="size-4" /> : <EyeOff className="size-4" />} label={published ? 'Visible in shop' : 'Hidden'} hint="Toggle to hide" />
            <Toggle on={clearance} onClick={() => setClearance(!clearance)} icon={<Tag className="size-4" />} label="Clearance" hint="Stock clearance tab" />
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-sand px-6 py-4">
          <p className="flex-1 text-sm text-red-700">{error}</p>
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2.5 text-sm text-muted hover:text-ink">
            Cancel
          </button>
          <button disabled={saving || uploading > 0} className="flex items-center gap-2 rounded-full bg-plum px-6 py-2.5 text-sm font-medium text-ivory transition hover:bg-ink disabled:opacity-60">
            {saving && <Loader2 className="size-4 animate-spin" />}
            {uploading > 0 ? 'Uploading…' : item ? 'Save changes' : 'Add to catalog'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs uppercase tracking-[0.2em] text-muted">{children}</p>
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <Label>
        {label} {hint && <span className="normal-case tracking-normal text-muted/70">· {hint}</span>}
      </Label>
      <div className="mt-2">{children}</div>
    </label>
  )
}

function Toggle({ on, onClick, icon, label, hint }: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string; hint: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${on ? 'border-plum bg-plum text-ivory' : 'border-sand text-ink hover:border-gold'}`}
      title={hint}
    >
      {icon} {label}
    </button>
  )
}

function PasswordDialog({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [status, setStatus] = useState<{ ok?: boolean; msg?: string }>({})

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await changePassword({ data: { current, next } })
      setStatus({ ok: true, msg: 'Password updated. Other devices have been signed out.' })
      setCurrent('')
      setNext('')
    } catch (err) {
      setStatus({ msg: errorText(err) })
    }
  }

  return (
    <div className="fade fixed inset-0 z-[70] grid place-items-center bg-ink/40 px-5 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-lg bg-ivory p-6 shadow-2xl">
        <h2 className="font-display text-3xl text-plum">Change password</h2>
        <div className="mt-5 space-y-4">
          <Field label="Current password">
            <input type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} className="field" />
          </Field>
          <Field label="New password" hint="6+ characters">
            <input type="password" required minLength={6} value={next} onChange={(e) => setNext(e.target.value)} className="field" />
          </Field>
        </div>
        {status.msg && <p className={`mt-3 text-sm ${status.ok ? 'text-whatsapp-ink' : 'text-red-700'}`}>{status.msg}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm text-muted">
            Close
          </button>
          <button className="rounded-full bg-plum px-5 py-2 text-sm text-ivory">Update</button>
        </div>
      </form>
    </div>
  )
}

/* ---------------- Orders ---------------- */

const STATUS_TONE: Record<string, string> = {
  pending_payment: 'bg-sand text-ink',
  payment_verification: 'bg-gold-soft text-ink',
  payment_verified: 'bg-whatsapp/20 text-whatsapp-ink',
  processing: 'bg-blush text-ink',
  packed: 'bg-blush text-ink',
  shipped: 'bg-ink/10 text-ink',
  delivered: 'bg-whatsapp/20 text-whatsapp-ink',
  cancelled: 'bg-sand text-muted',
  payment_rejected: 'bg-red-100 text-red-800',
}

function StatusPill({ status }: { status: string }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs whitespace-nowrap ${STATUS_TONE[status] ?? 'bg-sand'}`}>{statusLabel(status)}</span>
}

const shortDate = (d: Date | string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const longDate = (d: Date | string) =>
  new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function OrdersTab({ orders, payment }: { orders: OrderRow[]; payment: PaymentSettings }) {
  const [filter, setFilter] = useState<string>('')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)
  const q = query.trim().toLowerCase()
  const shown = orders.filter(
    (o) => (!filter || o.status === filter) && (!q || `${o.number} ${o.customerName} ${o.phone}`.toLowerCase().includes(q)),
  )
  const counts = new Map<string, number>()
  for (const o of orders) counts.set(o.status, (counts.get(o.status) ?? 0) + 1)

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-5 py-8 lg:grid-cols-[1fr_20rem]">
      <section className="min-w-0">
        <div className="mb-4">
          <h1 className="font-display text-4xl text-plum">Orders</h1>
          <p className="text-sm text-muted">{orders.length} online {orders.length === 1 ? 'order' : 'orders'} · verify each payment proof against your bank statement</p>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          <FilterChip on={!filter} onClick={() => setFilter('')} label={`All · ${orders.length}`} />
          {ORDER_STATUSES.filter((s) => counts.get(s.key)).map((s) => (
            <FilterChip key={s.key} on={filter === s.key} onClick={() => setFilter(s.key)} label={`${s.label} · ${counts.get(s.key)}`} />
          ))}
        </div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search order number, name or phone" className="field mb-4 text-sm" />

        {shown.length === 0 ? (
          <div className="grid place-items-center rounded-lg border border-dashed border-sand bg-ivory py-16 text-center">
            <Package className="size-8 text-gold" />
            <p className="mt-3 font-display text-2xl text-plum">{orders.length ? 'No matching orders' : 'No orders yet'}</p>
            <p className="mt-1 text-sm text-muted">Online orders appear here as soon as a customer uploads their payment proof.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-sand bg-ivory">
            <table className="w-full text-sm">
              <thead className="hidden border-b border-sand bg-cream/60 text-left text-xs text-muted md:table-header-group">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Order</th>
                  <th className="px-4 py-2.5 font-medium">Customer</th>
                  <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                  <th className="px-4 py-2.5 font-medium">Payment</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand">
                {shown.map((o) => (
                  <tr key={o.id} onClick={() => setOpenId(o.id)} className="grid cursor-pointer grid-cols-[1fr_auto] gap-x-3 gap-y-1 p-4 hover:bg-cream/60 md:table-row md:p-0">
                    <td className="md:px-4 md:py-3">
                      <button type="button" className="font-medium text-plum hover:underline">{o.number}</button>
                      <span className="ml-2 text-xs text-muted md:hidden">{shortDate(o.createdAt)}</span>
                    </td>
                    <td className="col-span-2 row-start-2 md:px-4 md:py-3">
                      {o.customerName}
                      <span className="block text-xs text-muted">{o.city} · {o.pieces} {o.pieces === 1 ? 'piece' : 'pieces'}</span>
                    </td>
                    <td className="text-right font-medium md:px-4 md:py-3">{formatPrice(o.total)}</td>
                    <td className="hidden text-xs text-muted md:table-cell md:px-4 md:py-3">{PAYMENT_STATUS_LABEL[o.paymentStatus] ?? o.paymentStatus}</td>
                    <td className="col-span-2 md:px-4 md:py-3"><StatusPill status={o.status} /></td>
                    <td className="hidden text-muted md:table-cell md:px-4 md:py-3">{shortDate(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <aside className="space-y-6">
        <PaymentSettingsCard settings={payment} />
      </aside>
      {openId != null && <OrderDrawer id={openId} onClose={() => setOpenId(null)} />}
    </main>
  )
}

function FilterChip({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-full border px-3 py-1 text-xs transition ${on ? 'border-plum bg-plum text-ivory' : 'border-sand bg-ivory hover:border-gold'}`}>
      {label}
    </button>
  )
}

type AdminOrder = Awaited<ReturnType<typeof getAdminOrder>>

function OrderDrawer({ id, onClose }: { id: number; onClose: () => void }) {
  const router = useRouter()
  const [data, setData] = useState<AdminOrder | null>(null)
  const [loadError, setLoadError] = useState('')
  const [status, setStatus] = useState<OrderStatus>('payment_verification')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null)

  async function load() {
    try {
      const d = await getAdminOrder({ data: { id } })
      setData(d)
      setStatus(d.order.status as OrderStatus)
      setNotes(d.order.adminNotes)
    } catch (err) {
      setLoadError(errorText(err))
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function changeStatus(next: OrderStatus, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return
    setBusy(next)
    setMsg(null)
    try {
      await updateOrderStatus({ data: { id, status: next } })
      await Promise.all([load(), router.invalidate()])
      setMsg({ ok: true, text: `Marked as ${statusLabel(next)}` })
    } catch (err) {
      setMsg({ text: errorText(err) })
    } finally {
      setBusy('')
    }
  }

  async function saveNotes() {
    setBusy('notes')
    setMsg(null)
    try {
      await saveOrderNotes({ data: { id, notes } })
      setMsg({ ok: true, text: 'Notes saved' })
    } catch (err) {
      setMsg({ text: errorText(err) })
    } finally {
      setBusy('')
    }
  }

  const o = data?.order
  const pay = data?.payments[0]
  const awaitingReview = o && (o.paymentStatus === 'submitted' || o.paymentStatus === 'pending')

  return (
    <div className="fade fixed inset-0 z-[70] flex justify-end bg-ink/40 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-xl flex-col bg-ivory shadow-2xl" role="dialog" aria-modal="true" aria-label="Order details">
        <div className="flex items-center justify-between border-b border-sand px-6 py-4">
          <div>
            <h2 className="font-display text-3xl text-plum">{o?.number ?? 'Order'}</h2>
            {o && <p className="text-xs text-muted">Placed {longDate(o.createdAt)} · updated {longDate(o.updatedAt)}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-muted hover:bg-cream" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6 text-sm">
          {loadError && <p className="text-red-700">{loadError}</p>}
          {!data && !loadError && <Loader2 className="mx-auto size-6 animate-spin text-muted" />}
          {o && data && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={o.status} />
                <span className="text-xs text-muted">Payment: {PAYMENT_STATUS_LABEL[o.paymentStatus] ?? o.paymentStatus}</span>
                {!o.stockReserved && <span className="text-xs text-muted">· stock returned</span>}
              </div>

              <section>
                <Label>Customer</Label>
                <div className="mt-2 rounded-lg border border-sand bg-white p-4 leading-relaxed">
                  <p className="font-medium">{o.customerName}</p>
                  <p className="flex flex-wrap gap-x-3">
                    <a href={`tel:+977${o.phone}`} className="inline-flex items-center gap-1 text-plum hover:underline"><Phone className="size-3.5" /> {o.phone}</a>
                    <a href={`https://wa.me/977${o.phone}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-whatsapp-ink hover:underline"><WhatsAppIcon className="size-3.5" /> WhatsApp</a>
                    {o.email && <a href={`mailto:${o.email}`} className="text-plum hover:underline">{o.email}</a>}
                  </p>
                  <p className="mt-2 text-muted">
                    {o.address}, {o.area}, {o.city}
                    {o.landmark && <><br />Landmark: {o.landmark}</>}
                  </p>
                </div>
              </section>

              <section>
                <Label>Pieces</Label>
                <ul className="mt-2 divide-y divide-sand rounded-lg border border-sand bg-white">
                  {data.lines.map((l) => (
                    <li key={l.id} className="flex items-center gap-3 p-3">
                      <div className="size-12 shrink-0 overflow-hidden rounded bg-cream">{l.image && <img src={cdn(l.image, 100)} alt="" className="size-full object-cover" />}</div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{l.name}</p>
                        <p className="text-xs text-muted">
                          <span className="font-semibold text-ink">{l.size}</span>
                          {l.colour && ` · ${l.colour}`} · Qty {l.quantity} · {formatPrice(l.unitPrice)} each
                        </p>
                      </div>
                      <p className="font-medium">{formatPrice(l.lineTotal)}</p>
                    </li>
                  ))}
                </ul>
                <div className="mt-3">
                  <PriceBreakdown b={{ ...orderBreakdown(o), totalLabel: 'Total to receive' }} />
                </div>
              </section>

              <section>
                <Label>Payment · {PAYMENT_METHODS[o.paymentMethod as keyof typeof PAYMENT_METHODS] ?? o.paymentMethod}</Label>
                {pay ? (
                  <div className="mt-2 rounded-lg border border-sand bg-white p-4">
                    <dl className="grid grid-cols-[9rem_1fr] gap-y-1">
                      <dt className="text-muted">Amount</dt><dd className="font-medium">{formatPrice(pay.amount)}</dd>
                      <dt className="text-muted">Transaction ID</dt><dd>{pay.transactionId || <span className="text-muted">Not given</span>}</dd>
                      <dt className="text-muted">Payment date</dt><dd>{pay.paymentDate || <span className="text-muted">Not given</span>}</dd>
                      <dt className="text-muted">Proof status</dt><dd className="capitalize">{pay.status}{pay.reviewedAt ? ` · ${longDate(pay.reviewedAt)}` : ''}</dd>
                    </dl>
                    {pay.proofKey && (
                      <a href={`/api/payment-proof/${pay.id}`} target="_blank" rel="noreferrer" className="mt-3 block overflow-hidden rounded border border-sand bg-cream">
                        {pay.proofType === 'application/pdf' ? (
                          <span className="flex items-center gap-2 p-4 text-plum"><ExternalLink className="size-4" /> Open payment proof (PDF)</span>
                        ) : (
                          <img src={`/api/payment-proof/${pay.id}`} alt="Payment proof" className="max-h-[28rem] w-full object-contain" />
                        )}
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-muted">No payment recorded.</p>
                )}
                {awaitingReview && (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => changeStatus('payment_verified', `Confirm you received ${formatPrice(o.total)} for ${o.number}?`)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-full bg-whatsapp-ink py-2.5 text-sm font-medium text-white disabled:opacity-60"
                    >
                      {busy === 'payment_verified' ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} Verify payment
                    </button>
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => changeStatus('payment_rejected', `Reject the payment for ${o.number}? Its pieces go back into stock.`)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-full border border-red-700 py-2.5 text-sm font-medium text-red-700 disabled:opacity-60"
                    >
                      {busy === 'payment_rejected' ? <Loader2 className="size-4 animate-spin" /> : <ShieldX className="size-4" />} Reject payment
                    </button>
                  </div>
                )}
              </section>

              <section>
                <Label>Order status</Label>
                <div className="mt-2 flex gap-2">
                  <select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)} className="field">
                    {ORDER_STATUSES.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!!busy || status === o.status}
                    onClick={() => changeStatus(status, status === 'cancelled' ? `Cancel ${o.number}? Its pieces go back into stock.` : undefined)}
                    className="flex items-center gap-2 rounded-full bg-plum px-5 text-sm text-ivory disabled:opacity-50"
                  >
                    {busy === status && <Loader2 className="size-4 animate-spin" />} Update
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted">Cancelled and Payment Rejected return the pieces to stock; moving back reserves them again.</p>
              </section>

              <section>
                <Label>Internal notes <span className="normal-case tracking-normal">· never shown to the customer</span></Label>
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="field mt-2 resize-y" placeholder="e.g. Courier booked with Pathao, tracking 1234" />
                <div className="mt-2 flex justify-end">
                  <button type="button" disabled={!!busy || notes === o.adminNotes} onClick={saveNotes} className="rounded-full border border-sand px-4 py-1.5 text-sm hover:border-gold disabled:opacity-50">
                    Save notes
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
        {msg && <p className={`border-t border-sand px-6 py-3 text-sm ${msg.ok ? 'text-whatsapp-ink' : 'text-red-700'}`}>{msg.text}</p>}
      </div>
    </div>
  )
}

const PAYMENT_FIELDS = [
  { key: 'bank_name', label: 'Bank name', placeholder: 'e.g. Nabil Bank' },
  { key: 'bank_account_name', label: 'Account name', placeholder: 'e.g. Aura Luxe Pvt. Ltd.' },
  { key: 'bank_account_number', label: 'Account number', placeholder: '' },
  { key: 'bank_branch', label: 'Branch', placeholder: 'e.g. New Baneshwor' },
] as const

function PaymentSettingsCard({ settings }: { settings: PaymentSettings }) {
  const router = useRouter()
  const [values, setValues] = useState(settings)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState<{ ok?: boolean; msg?: string; busy?: boolean }>({})
  const set = (k: keyof PaymentSettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues({ ...values, [k]: e.target.value })

  async function uploadQr(file: File | undefined) {
    if (!file) return
    setUploading(true)
    setStatus({})
    try {
      setValues((v) => ({ ...v, payment_qr: '' }))
      const src = await uploadImage(file, { crop: false })
      setValues((v) => ({ ...v, payment_qr: src }))
      setStatus({ msg: 'QR uploaded — press Save to publish it' })
    } catch (err) {
      setStatus({ msg: errorText(err) })
    } finally {
      setUploading(false)
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setStatus({ busy: true })
    try {
      const { delivery_charge, ...rest } = values
      setValues({ ...(await savePaymentSettings({ data: rest })), delivery_charge })
      setStatus({ ok: true, msg: 'Saved — checkout is updated' })
      await router.invalidate()
    } catch (err) {
      setStatus({ msg: errorText(err) })
    }
  }

  const open = Boolean(values.payment_qr || (values.bank_name && values.bank_account_number))

  return (
    <Card title="Payment settings">
      <form onSubmit={save} className="space-y-3">
        {!open && <p className="rounded bg-gold-soft/50 p-2 text-xs">Checkout stays closed until you add a QR code or bank name + account number.</p>}
        {PAYMENT_FIELDS.map((f) => (
          <label key={f.key} className="block text-xs text-muted">
            {f.label}
            <input value={values[f.key]} onChange={set(f.key)} className="field mt-1 text-sm" placeholder={f.placeholder} />
          </label>
        ))}
        <div className="text-xs text-muted">
          QR code
          <div className="mt-1 flex items-center gap-3">
            <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded border border-sand bg-white">
              {uploading ? <Loader2 className="size-5 animate-spin" /> : values.payment_qr ? <img src={values.payment_qr} alt="Payment QR" className="size-full object-contain" /> : <QrCode className="size-8 text-sand" />}
            </div>
            <div className="flex flex-col items-start gap-1">
              <label className="cursor-pointer rounded-full border border-sand px-3 py-1 text-sm text-ink hover:border-gold">
                {values.payment_qr ? 'Replace QR' : 'Upload QR'}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { uploadQr(e.target.files?.[0]); e.target.value = '' }} />
              </label>
              {values.payment_qr && (
                <button type="button" onClick={() => setValues({ ...values, payment_qr: '' })} className="text-xs text-red-700">Remove</button>
              )}
            </div>
          </div>
        </div>
        <label className="block text-xs text-muted">
          Payment instructions
          <textarea rows={3} value={values.payment_instructions} onChange={set('payment_instructions')} className="field mt-1 resize-y text-sm" placeholder="e.g. Use your name as the remarks. Orders are verified within 24 hours." />
        </label>
        <label className="block text-xs text-muted">
          Confirmation message
          <textarea rows={3} value={values.payment_confirmation_message} onChange={set('payment_confirmation_message')} className="field mt-1 resize-y text-sm" placeholder="Your payment proof has been submitted. Our team will verify the payment and confirm your order shortly." />
        </label>
        <label className="block text-xs text-muted">
          Max proof size (MB)
          <input inputMode="numeric" value={values.proof_max_mb} onChange={set('proof_max_mb')} className="field mt-1 text-sm" placeholder={String(PROOF_MAX_MB_LIMIT)} />
        </label>
        <p className="text-xs text-muted">
          Delivery charges, zones and free delivery are set under{' '}
          <Link to="/admin" search={{ tab: 'offers' }} className="text-plum underline">Offers &amp; Discounts</Link>.
        </p>
        <div className="flex items-center justify-between gap-2">
          <p className={`text-xs ${status.ok ? 'text-whatsapp-ink' : 'text-red-700'}`}>{status.msg}</p>
          <button disabled={status.busy || uploading} className="rounded-full bg-plum px-4 py-1.5 text-sm text-ivory disabled:opacity-60">
            Save
          </button>
        </div>
        <p className="text-xs text-muted">Shown on the checkout page. Proofs up to {PROOF_MAX_MB_LIMIT} MB (Netlify’s request limit); large photos are shrunk on the customer’s phone first.</p>
      </form>
    </Card>
  )
}
