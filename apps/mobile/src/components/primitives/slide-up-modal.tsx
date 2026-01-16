import * as React from 'react'
import { Animated, Modal, Pressable } from 'react-native'

interface SlideUpModalProps {
  visible: boolean
  onClose: () => void
  children: React.ReactNode
  contentClassName?: string
}

/**
 * Reusable slide-up modal with fade backdrop.
 */
export function SlideUpModal({ visible, onClose, children, contentClassName = '' }: SlideUpModalProps) {
  const [isAnimating, setIsAnimating] = React.useState(false)
  const animation = React.useMemo(() => new Animated.Value(0), [])

  const isMounted = visible || isAnimating

  const startEnterAnimation = React.useCallback(() => {
    // Allow state update here to keep modal mounted during the enter animation.
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setIsAnimating(true)
    animation.setValue(0)
    Animated.timing(animation, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start()
  }, [animation])

  const startExitAnimation = React.useCallback(() => {
    Animated.timing(animation, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        // Allow state update here to unmount after exit animation completes.
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
        setIsAnimating(false)
      }
    })
  }, [animation])

  React.useEffect(() => {
    if (visible) {
      startEnterAnimation()
    }
    else if (isAnimating) {
      startExitAnimation()
    }
  }, [isAnimating, startEnterAnimation, startExitAnimation, visible])

  if (!isMounted) {
    return null
  }

  return (
    <Modal
      animationType="none"
      transparent
      visible={isMounted}
      onRequestClose={onClose}
    >
      <Animated.View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(0,0,0,0.4)',
          opacity: animation,
        }}
      >
        <Pressable className="flex-1" onPress={onClose} />
        <Animated.View
          className={`rounded-t-3xl bg-white px-6 py-8 dark:bg-zinc-900 ${contentClassName}`}
          style={{
            transform: [
              {
                translateY: animation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [40, 0],
                }),
              },
            ],
            opacity: animation,
          }}
        >
          {children}
        </Animated.View>
      </Animated.View>
    </Modal>
  )
}
