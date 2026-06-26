import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@boilerstone/ui/lib/utils'

interface AppLoaderProps {
  className?: string
}

/**
 * Full-screen animated loading overlay with staggered bouncing dots.
 * Mount/unmount it via the parent to trigger the enter/exit animations.
 *
 * @example
 * {isLoading && <AppLoader />}
 */
export function AppLoader({ className }: AppLoaderProps) {
  return (
    <AnimatePresence>
      <motion.div
        className={cn(
          'fixed inset-0 z-50 flex items-center justify-center bg-background bg-gradient-bg',
          className,
        )}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <motion.div
          className="flex flex-col items-center gap-8"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
        >
          <LoadingDots />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

const DOT_DELAY = [0, 0.15, 0.3] as const

function LoadingDots() {
  return (
    <div className="flex items-center gap-2">
      {DOT_DELAY.map((delay, index) => (
        <motion.div
          key={index}
          className="size-3 rounded-full bg-primary"
          animate={{ y: [0, -10, 0] }}
          transition={{
            duration: 0.8,
            ease: 'easeInOut',
            repeat: Infinity,
            repeatDelay: 0.3,
            delay,
          }}
        />
      ))}
    </div>
  )
}
