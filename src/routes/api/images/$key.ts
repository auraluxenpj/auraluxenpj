import { createFileRoute } from '@tanstack/react-router'
import { imageStore } from '@/server/images.server'

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
}

export const Route = createFileRoute('/api/images/$key')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const data = await imageStore().get(params.key, { type: 'arrayBuffer' })
        if (!data) return new Response('Not found', { status: 404 })
        const ext = params.key.split('.').pop() ?? 'jpg'
        return new Response(data, {
          headers: {
            'Content-Type': CONTENT_TYPES[ext] ?? 'application/octet-stream',
            // Keys are unique per upload, so the file never changes
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        })
      },
    },
  },
})
