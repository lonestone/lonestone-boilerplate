import type { IntersectionOptions } from 'react-intersection-observer'
import { useInView as useInViewOriginal } from 'react-intersection-observer'

/**
 * A hook that tracks when an element is in the viewport, using the Intersection Observer API.
 * Re-exported from react-intersection-observer for consistency.
 *
 * @see https://github.com/thebuilder/react-intersection-observer
 */
export const useInView = useInViewOriginal

export type { IntersectionOptions }
