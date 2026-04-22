import { useRef, useEffect, useCallback } from "react";

/**
 * Custom hook for futuristic 3D tilt effect on hover.
 * Applies perspective + rotateX/Y transforms based on mouse position.
 * @param {number} intensity - Degrees of max tilt (default 8)
 * @returns {React.RefObject} ref to attach to the target element
 */
export function useTilt(intensity = 8) {
  const ref = useRef(null);

  const handleMouseMove = useCallback(
    (e) => {
      const el = ref.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -intensity;
      const rotateY = ((x - centerX) / centerX) * intensity;

      el.style.transform = `perspective(600px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.03)`;
      el.style.boxShadow = "0 0 30px 10px rgba(100, 100, 255, 0.15)";
    },
    [intensity],
  );

  const handleMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform =
      "perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)";
    el.style.boxShadow = "";
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.style.transition = "transform 0.3s ease, box-shadow 0.3s ease";
    el.style.transformStyle = "preserve-3d";
    el.style.willChange = "transform";

    el.addEventListener("mousemove", handleMouseMove);
    el.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      el.removeEventListener("mousemove", handleMouseMove);
      el.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [handleMouseMove, handleMouseLeave]);

  return ref;
}
