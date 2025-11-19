import type { LoaderFunctionArgs } from '@remix-run/node'
import { loader as coverageLoader } from './api.importer.diagnostics.reelseats.coverage'

// Resource wrapper to return pure JSON for coverage diagnostics
export async function loader(args: LoaderFunctionArgs) {
  return coverageLoader(args)
}

export const handle = { private: true }

// No default export to keep this a pure resource route returning JSON
