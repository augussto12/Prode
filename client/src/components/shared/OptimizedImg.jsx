/**
 * OptimizedImg — Drop-in replacement for <img> that adds
 * loading="lazy", decoding="async", fetchpriority, and explicit dimensions.
 * Use `eager` prop for above-the-fold images.
 */
export default function OptimizedImg({ src, alt, width, height, className, style, eager, ...rest }) {
  return (
    <img
      src={src}
      alt={alt || ''}
      width={width}
      height={height}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={eager ? 'high' : 'low'}
      className={className}
      style={style}
      {...rest}
    />
  );
}
