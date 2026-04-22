import { useReducedMotion } from "framer-motion";

export function useAnimationConfig() {
  const shouldReduce = useReducedMotion();

  return {
    initial: shouldReduce ? {} : { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: shouldReduce
      ? { duration: 0 }
      : { duration: 0.3, ease: "easeOut" },
  };
}
