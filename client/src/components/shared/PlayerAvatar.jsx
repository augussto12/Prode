import { useState } from 'react';

export default function PlayerAvatar({ id, photo, name, size = 'md', className = '' }) {
  const [error, setError] = useState(false);
  
  const sizeClasses = {
    sm: 'w-6 h-6 md:w-8 md:h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  const initial = name ? name.charAt(0).toUpperCase() : '?';
  const imgUrl = photo || (id ? `https://media.api-sports.io/football/players/${id}.png` : null);

  if (error || !imgUrl) {
    return (
      <div className={`${sizeClasses[size]} rounded-full bg-white/10 border border-white/20 flex items-center justify-center shrink-0 ${className}`}>
        <span className="font-bold text-white/50 text-xs">{initial}</span>
      </div>
    );
  }

  return (
    <div className={`${sizeClasses[size]} rounded-full overflow-hidden bg-white/5 shrink-0 border border-white/10 ${className}`}>
      <img 
        src={imgUrl} 
        alt={name || 'Player'}
        loading="lazy"
        decoding="async"
        width={40}
        height={40}
        className="w-full h-full object-cover bg-white/10"
        onError={() => setError(true)}
      />
    </div>
  );
}
