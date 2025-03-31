import type { DehydratedState } from '@tanstack/query-core'
import { useMatches } from 'react-router'

function useDehydratedState(): DehydratedState {
  const matches = useMatches()

  const dehydratedStates = matches
    .map((match) => {
      const matchData = match.data as { dehydratedState?: DehydratedState }
      return matchData?.dehydratedState
    })
    .filter((state): state is DehydratedState => state !== undefined)

  const initialState: DehydratedState = { queries: [], mutations: [] }

  return dehydratedStates.length
    ? dehydratedStates.reduce<DehydratedState>(
        (acc, curr) => ({
          queries: [...acc.queries, ...curr.queries],
          mutations: [...acc.mutations, ...curr.mutations],
        }),
        initialState,
      )
    : initialState
}

export { useDehydratedState }
