const MAX_EDGE = 1800
/** Catalog frame (width / height) — matches the 4:5 cards and product gallery. */
const ASPECT = 4 / 5
/** Breathing room kept around the detected subject, as a share of its size. */
const PADDING = 0.12
/** Never zoom in further than this share of the largest possible 4:5 crop. */
const MIN_ZOOM = 0.55

type Box = { x: number; y: number; w: number; h: number }

/**
 * Find the subject's bounding box by comparing pixels against the background colour
 * sampled from the photo's edges. Returns null when nothing stands out (busy scenes).
 */
function findSubject(bitmap: ImageBitmap): Box | null {
  const size = 160
  const s = size / Math.max(bitmap.width, bitmap.height)
  const w = Math.max(1, Math.round(bitmap.width * s))
  const h = Math.max(1, Math.round(bitmap.height * s))
  const ctx = Object.assign(document.createElement('canvas'), { width: w, height: h }).getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(bitmap, 0, 0, w, h)
  const px = ctx.getImageData(0, 0, w, h).data

  // Background = average of the outermost ring of pixels.
  let r = 0, g = 0, b = 0, n = 0
  const sample = (x: number, y: number) => {
    const i = (y * w + x) * 4
    if (px[i + 3] < 16) return
    r += px[i]; g += px[i + 1]; b += px[i + 2]; n++
  }
  for (let x = 0; x < w; x++) { sample(x, 0); sample(x, h - 1) }
  for (let y = 0; y < h; y++) { sample(0, y); sample(w - 1, y) }
  if (n) { r /= n; g /= n; b /= n }

  let minX = w, minY = h, maxX = -1, maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (px[i + 3] < 16) continue
      const d = Math.abs(px[i] - r) + Math.abs(px[i + 1] - g) + Math.abs(px[i + 2] - b)
      if (!n || d > 60) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  const box = { x: minX / s, y: minY / s, w: (maxX - minX + 1) / s, h: (maxY - minY + 1) / s }
  // Subject fills (almost) the whole photo → no plain background to trim.
  if (box.w * box.h > 0.95 * bitmap.width * bitmap.height) return null
  return box
}

/** Pick a 4:5 crop that frames the subject, trimming empty background around it. */
function cropFor(bitmap: ImageBitmap): Box {
  const W = bitmap.width, H = bitmap.height
  // Largest 4:5 rectangle that fits in the photo.
  const maxW = Math.min(W, H * ASPECT)
  const subject = findSubject(bitmap)

  let cw = maxW
  let cx = W / 2, cy = H / 2
  if (subject) {
    const needW = Math.max(subject.w * (1 + 2 * PADDING), subject.h * (1 + 2 * PADDING) * ASPECT)
    cw = Math.min(maxW, Math.max(needW, maxW * MIN_ZOOM))
    cx = subject.x + subject.w / 2
    cy = subject.y + subject.h / 2
  }
  const ch = cw / ASPECT
  const x = Math.min(Math.max(cx - cw / 2, 0), W - cw)
  const y = Math.min(Math.max(cy - ch / 2, 0), H - ch)
  return { x, y, w: cw, h: ch }
}

/**
 * Auto-crop photos to the catalog's 4:5 portrait frame (centred on the piece) and shrink
 * large phone photos in the browser before uploading, so uploads stay fast and consistent.
 */
async function prepare(file: File, autoCrop: boolean): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file
  const crop = autoCrop ? cropFor(bitmap) : { x: 0, y: 0, w: bitmap.width, h: bitmap.height }
  const scale = Math.min(1, MAX_EDGE / Math.max(crop.w, crop.h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(crop.w * scale)
  canvas.height = Math.round(crop.h * scale)
  const ctx = canvas.getContext('2d')!
  // JPEG has no transparency — give transparent PNGs a clean white backdrop.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.88))
  return blob ?? file
}

/** Upload a photo to the catalog store. Pass crop: false for images that must stay whole (e.g. a payment QR code). */
export async function uploadImage(file: File, { crop = true } = {}): Promise<string> {
  const blob = await prepare(file, crop)
  const body = new FormData()
  body.append('file', blob instanceof File ? blob : new File([blob], 'photo.jpg', { type: blob.type }))
  const res = await fetch('/api/upload', { method: 'POST', body })
  const json = (await res.json().catch(() => ({}))) as { src?: string; error?: string }
  if (!res.ok || !json.src) throw new Error(json.error ?? 'Upload failed. Please try again.')
  return json.src
}

/**
 * Payment screenshots: re-encode large photos as a sharp JPEG (max 2200px) so they stay
 * readable but upload quickly on mobile data. PDFs and small images are sent as-is.
 */
export async function prepareProof(file: File): Promise<File> {
  if (!/^image\/(jpeg|png)$/.test(file.type) || file.size < 1.5 * 1024 * 1024) return file
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file
  const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height))
  const canvas = Object.assign(document.createElement('canvas'), {
    width: Math.round(bitmap.width * scale),
    height: Math.round(bitmap.height * scale),
  })
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.9))
  if (!blob || blob.size >= file.size) return file
  return new File([blob], 'payment-proof.jpg', { type: 'image/jpeg' })
}
