import { getStore } from '@netlify/blobs'

export const IMAGE_PREFIX = '/api/images/'

export const imageStore = () => getStore('catalog-images')

/** Remove uploaded photos from Blobs (bundled sample photos under /img are left alone). */
export async function deleteUploadedImages(srcs: string[]) {
  const store = imageStore()
  await Promise.all(
    srcs
      .filter((src) => src.startsWith(IMAGE_PREFIX))
      .map((src) => store.delete(src.slice(IMAGE_PREFIX.length)).catch(() => {})),
  )
}
