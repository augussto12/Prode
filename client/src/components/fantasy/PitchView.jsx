import React from 'react';
import { UserMinus } from 'lucide-react';
import { translatePosition } from '../../utils/positionTranslations';
import './FantasyTeam.css';

// Helper: format player name to "FirstName\nLastName" keeping it short
function formatPlayerName(fullName) {
  if (!fullName) return ['', ''];
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return [parts[0], ''];
  // Use first name + last name (skip middle names)
  return [parts[0], parts[parts.length - 1]];
}

// Componente para renderizar la cancha y los jugadores encima
export default function PitchView({ squad, onPlayerClick, activeGameweek, formation = "4-4-2" }) {
  // Ordenar squad: Starters y Benched
  const starters = squad.filter(p => !p.isBenched);

  const [defCount, midCount, fwdCount] = formation.split('-').map(Number);
  const limits = { GK: 1, DEF: defCount, MID: midCount, FWD: fwdCount };

  const getPositionGroup = (pos) => {
     const players = starters.filter(p => p.playerPosition === pos);
     const needed = limits[pos] || 0;
     
     // Inject dummy slots if positions are missing
     const filled = players.length;
     for (let i = filled; i < needed; i++) {
        players.push({
           isDummy: true,
           playerId: `dummy_${pos}_${i}`,
           playerPosition: pos,
           playerName: 'Hueco'
        });
     }
     return players;
  }

  return (
    <div className="pitch-container">
      <div className="pitch-grass">
        {/* Líneas de la cancha */}
        <div className="pitch-line center-line"></div>
        <div className="pitch-circle"></div>
        <div className="pitch-box penalty-box bottom"></div>
        <div className="pitch-box penalty-box top"></div>
        
        <div className="pitch-players-overlay">
           <PositionRow players={getPositionGroup('FWD')} onPlayerClick={onPlayerClick} activeGameweek={activeGameweek} />
           <PositionRow players={getPositionGroup('MID')} onPlayerClick={onPlayerClick} activeGameweek={activeGameweek} />
           <PositionRow players={getPositionGroup('DEF')} onPlayerClick={onPlayerClick} activeGameweek={activeGameweek} />
           <PositionRow players={getPositionGroup('GK')} onPlayerClick={onPlayerClick} activeGameweek={activeGameweek} />
        </div>
      </div>
      
    </div>
  );
}

function PositionRow({ players, onPlayerClick, activeGameweek }) {
  return (
    <div className="pitch-row">
      {players.map(p => (
         <PlayerCard key={p.playerId} player={p} onClick={() => onPlayerClick(p)} activeGameweek={activeGameweek}/>
      ))}
    </div>
  );
}

function PlayerCard({ player, onClick, activeGameweek, isBench }) {
  if (player.isDummy) {
     return (
        <div className="fantasy-player-card dummy cursor-pointer transition hover:scale-110 drop-shadow-md" onClick={() => onClick(player)}>
           <div className="jersey flex items-center justify-center font-black text-2xl" style={{background: 'rgba(255,255,255,0.15)', border: '2px dashed rgba(255,255,255,0.7)', color: 'rgba(255,255,255,0.9)'}}>
              +
           </div>
        </div>
     );
  }

  const [firstName, lastName] = formatPlayerName(player.fullName || player.playerName);
  const hasPhoto = player.photoUrl;

  return (
     <div className={`fantasy-player-card ${isBench ? 'benched' : ''} group cursor-pointer transition-transform hover:scale-105 relative`} onClick={onClick}>
        {/* Remove overlay (appears on hover) */}
        <div className="absolute inset-0 bg-red-500/80 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
           <UserMinus className="text-white" size={24} />
        </div>
        
        <div className="jersey relative z-0 overflow-hidden">
           {hasPhoto ? (
              <img 
                src={player.photoUrl} 
                alt={player.playerName} 
                className="w-full h-full object-cover rounded-full"
                loading="lazy"
                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
              />
           ) : null}
           <span style={{ display: hasPhoto ? 'none' : 'flex' }} className="w-full h-full items-center justify-center">
              {translatePosition(player.playerPosition)}
           </span>
           {player.isCaptain && <div className="captain-badge">C</div>}
           {player.isViceCaptain && <div className="captain-badge vice">V</div>}
        </div>
        <div className="player-info-box">
           <div className="player-name" style={{ whiteSpace: 'normal', lineHeight: '1.15' }}>
              {firstName}
              {lastName && <><br/>{lastName}</>}
           </div>
           {activeGameweek?.isActive && player.points !== null && (
              <div className="player-pts">{player.points} pts</div>
           )}
        </div>
     </div>
  );
}
