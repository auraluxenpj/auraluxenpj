import { createRouter, stringifySearchWith } from '@tanstack/react-router'

// Import the generated route tree
import { routeTree } from './routeTree.gen'

// Create a new router instance
export const getRouter = () => {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Keep plain query strings: the default re-quotes numeric strings, which turned /shop?c=1 into a
    // redirect to /shop?c=%221%22 (a duplicate URL for every category). Parsing is unchanged, so old links still work.
    stringifySearch: stringifySearchWith(JSON.stringify),
  })

  return router
}
