import { createFileRoute } from '@tanstack/react-router'
import { isAdminRequest } from '@/server/auth.server'
import { IMAGE_PREFIX, imageStore } from '@/server/images.server'

const MAX_BYTES = 8 * 1024 * 1024
const TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export const Route = createFileRoute('/api/upload')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isAdminRequest(request))) {
          return Response.json({ error: 'Please log in again.' }, { status: 401 })
        }
        const form = await request.formData()
        const file = form.get('file')
        if (!(file instanceof File)) return Response.json({ error: 'No file received.' }, { status: 400 })
        const ext = TYPES[file.type]
        if (!ext) return Response.json({ error: 'Use a JPG, PNG, WebP or GIF image.' }, { status: 400 })
        if (file.size > MAX_BYTES) return Response.json({ error: 'Image is larger than 8 MB.' }, { status: 400 })

        const key = `${crypto.randomUUID()}.${ext}`
        await imageStore().set(key, await file.arrayBuffer())
        return Response.json({ src: `${IMAGE_PREFIX}${key}` }, { status: 201 })
      },
    },
  },
})
