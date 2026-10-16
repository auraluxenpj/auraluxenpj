import { Link, createFileRoute } from '@tanstack/react-router'
import { SiteLayout } from '@/components/SiteChrome'
import { Wrap } from '@/components/Section'
import { WhatsAppIcon } from '@/components/WhatsAppIcon'
import { GREETING, whatsappLink } from '@/lib/format'
import { useSite } from '@/lib/site'
import { seo } from '@/lib/seo'

export const Route = createFileRoute('/help')({
  head: () =>
    seo({
      title: 'Size guide, FAQs & policies — Aura Luxe',
      description: 'Aura Luxe size guide, how WhatsApp ordering works, store visits, privacy and terms.',
      path: '/help',
    }),
  component: Help,
})

// General body measurements in inches. Individual pieces vary, so staff confirm fit on WhatsApp.
const SIZE_CHART = [
  ['XS', '32', '26', '35'],
  ['S', '34', '28', '37'],
  ['M', '36', '30', '39'],
  ['L', '38', '32', '41'],
  ['XL', '40', '34', '43'],
  ['XXL', '42', '36', '45'],
  ['3XL', '44', '38', '47'],
]

function Help() {
  const { whatsapp } = useSite()
  const chat = whatsappLink(whatsapp, GREETING)
  const faqs: [string, React.ReactNode][] = [
    [
      'How do I order?',
      'Pick your size and add pieces to your bag, then tap “Proceed to checkout”. Pay by bank transfer or QR, upload a screenshot of your payment and place the order — our team verifies the payment and confirms. Prefer to chat? Tap “Check availability on WhatsApp” and we’ll arrange everything there.',
    ],
    ['How do I pay?', 'Online orders are paid by bank transfer or by scanning our QR code. We don’t take card or wallet payments on the website. Your order is confirmed once we’ve verified your payment.'],
    ['Do I need an account?', 'No. Your wishlist, bag and recently viewed pieces are saved on your device only.'],
    ['Can I try pieces before buying?', <>Yes — visit our store to try pieces in person. <Link to="/" hash="visit" className="underline underline-offset-4">Store details</Link>.</>],
    ['Do you offer alterations or custom sizes?', 'Every outfit can be altered or made to your measurements. Just ask when you enquire.'],
    ['What currency are prices in?', 'All prices are in Nepali Rupees (Rs.). “Price on request” pieces are quoted on WhatsApp.'],
    ['Is my size available?', 'Sizes marked “Out of Stock” can’t be ordered right now — ask us on WhatsApp about restocks. Every other size shown on the product page is in stock.'],
  ]

  return (
    <SiteLayout>
      <Wrap className="pt-8 md:pt-12">
        <h1 className="font-display text-3xl tracking-[0.06em] uppercase sm:text-4xl">Help</h1>
        <nav aria-label="On this page" className="mt-4 flex flex-wrap gap-2 text-sm">
          {[
            ['size-guide', 'Size Guide'],
            ['faqs', 'FAQs'],
            ['privacy', 'Privacy Policy'],
            ['terms', 'Terms & Conditions'],
          ].map(([id, label]) => (
            <a key={id} href={`#${id}`} className="rounded-md border border-sand bg-white px-3.5 py-2 hover:border-ink">
              {label}
            </a>
          ))}
        </nav>

        <div className="mt-10 grid max-w-3xl gap-14">
          <section id="size-guide" className="scroll-mt-24">
            <h2 className="section-title">Size Guide</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              A general guide to body measurements in inches. Fits vary by piece — send us your measurements on WhatsApp and we will
              recommend the right size or arrange a fitting.
            </p>
            <div className="mt-5 overflow-x-auto rounded-lg border border-sand bg-white">
              <table className="w-full min-w-[22rem] text-left text-sm">
                <thead className="bg-cream text-[0.7rem] uppercase tracking-[0.14em]">
                  <tr>
                    {['Size', 'Bust', 'Waist', 'Hip'].map((h) => (
                      <th key={h} scope="col" className="px-4 py-3 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand">
                  {SIZE_CHART.map(([size, ...m]) => (
                    <tr key={size}>
                      <th scope="row" className="px-4 py-2.5 font-semibold">{size}</th>
                      {m.map((v, i) => (
                        <td key={i} className="px-4 py-2.5 text-muted">{v}″</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <a href={chat} target="_blank" rel="noreferrer" className="btn btn-whatsapp mt-5">
              <WhatsAppIcon className="size-4" /> Get sizing help
            </a>
          </section>

          <section id="faqs" className="scroll-mt-24">
            <h2 className="section-title">FAQs</h2>
            <div className="mt-4 divide-y divide-sand rounded-lg border border-sand bg-white">
              {faqs.map(([q, a]) => (
                <details key={q} className="group px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium">
                    {q}
                    <span aria-hidden className="text-lg text-muted transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{a}</p>
                </details>
              ))}
            </div>
          </section>

          <section id="privacy" className="scroll-mt-24 text-sm leading-relaxed text-muted">
            <h2 className="section-title">Privacy Policy</h2>
            <p className="mt-3">
              This website does not ask you to create an account and never asks for card details. Your wishlist, bag and recently
              viewed pieces are stored only in your browser on this device; clearing your browser data removes them. When you place an
              order we store your name, phone number, delivery address, optional email and your payment proof so we can verify payment
              and deliver. Payment proofs are kept privately and are only visible to the Aura Luxe team.
            </p>
            <p className="mt-3">
              When you tap a WhatsApp button, WhatsApp opens with a pre-written message. Nothing is sent until you press send, and the
              conversation is then handled under WhatsApp’s own privacy terms. We use the details you share only to answer your enquiry
              and arrange your order.
            </p>
          </section>

          <section id="terms" className="scroll-mt-24 text-sm leading-relaxed text-muted">
            <h2 className="section-title">Terms &amp; Conditions</h2>
            <p className="mt-3">
              This website is a catalogue. Prices are shown in Nepali Rupees (Rs.) and may change without notice. Adding a piece to your
              bag or sending a WhatsApp enquiry does not reserve it. Placing an order online reserves the pieces while we verify your
              payment; the order is confirmed once payment is verified. If a payment can’t be verified, the order is not confirmed and
              the pieces are released.
            </p>
            <p className="mt-3">Photos are for reference; colours can look slightly different depending on your screen.</p>
          </section>
        </div>
      </Wrap>
    </SiteLayout>
  )
}
