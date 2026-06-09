const GROUP_CARD_VARIANTS = [
  {
    background:
      "linear-gradient(135deg, color-mix(in srgb, var(--color-bg-start) 86%, #2dd4bf 14%), color-mix(in srgb, var(--color-bg-end) 90%, #2dd4bf 10%))",
    border: "color-mix(in srgb, #2dd4bf 30%, transparent)",
    accent: "#5eead4",
    badge: "color-mix(in srgb, #2dd4bf 14%, transparent)",
    shadow: "0 18px 38px rgba(20, 184, 166, 0.10)",
  },
  {
    background:
      "linear-gradient(135deg, color-mix(in srgb, var(--color-bg-start) 88%, #60a5fa 12%), color-mix(in srgb, var(--color-bg-end) 92%, #60a5fa 8%))",
    border: "color-mix(in srgb, #93c5fd 28%, transparent)",
    accent: "#93c5fd",
    badge: "color-mix(in srgb, #60a5fa 13%, transparent)",
    shadow: "0 18px 38px rgba(96, 165, 250, 0.09)",
  },
  {
    background:
      "linear-gradient(135deg, color-mix(in srgb, var(--color-bg-start) 88%, #fb7185 12%), color-mix(in srgb, var(--color-bg-end) 92%, #fb7185 8%))",
    border: "color-mix(in srgb, #fda4af 27%, transparent)",
    accent: "#fda4af",
    badge: "color-mix(in srgb, #fb7185 12%, transparent)",
    shadow: "0 18px 38px rgba(251, 113, 133, 0.09)",
  },
  {
    background:
      "linear-gradient(135deg, color-mix(in srgb, var(--color-bg-start) 87%, #f59e0b 13%), color-mix(in srgb, var(--color-bg-end) 91%, #f59e0b 9%))",
    border: "color-mix(in srgb, #fbbf24 28%, transparent)",
    accent: "#fde68a",
    badge: "color-mix(in srgb, #f59e0b 13%, transparent)",
    shadow: "0 18px 38px rgba(245, 158, 11, 0.09)",
  },
  {
    background:
      "linear-gradient(135deg, color-mix(in srgb, var(--color-bg-start) 88%, #a78bfa 12%), color-mix(in srgb, var(--color-bg-end) 92%, #a78bfa 8%))",
    border: "color-mix(in srgb, #c4b5fd 27%, transparent)",
    accent: "#c4b5fd",
    badge: "color-mix(in srgb, #a78bfa 12%, transparent)",
    shadow: "0 18px 38px rgba(167, 139, 250, 0.09)",
  },
];

export function getGroupCardVariant(group, index = 0) {
  const rawId = Number(group?.id);
  const variantIndex = Number.isFinite(rawId)
    ? Math.abs(rawId) % GROUP_CARD_VARIANTS.length
    : index % GROUP_CARD_VARIANTS.length;
  return GROUP_CARD_VARIANTS[variantIndex];
}
