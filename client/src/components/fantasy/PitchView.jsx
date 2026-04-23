import React from 'react';
import { UserMinus, Crown } from 'lucide-react';
import { translatePosition } from '../../utils/positionTranslations';
import './FantasyTeam.css';

// Helper: format player name to "FirstName\nLastName" keeping it short
function formatPlayerName(fullName) {
  if (!fullName) return ['', ''];
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return [parts[0], ''];
  return [parts[0], parts[parts.length - 1]];
}

/**
 * PitchView — Cancha con jugadores
 * @param {object[]} squad - Picks del equipo
 * @param {function} onPlayerClick - Click para sacar jugador / abrir mercado
 * @param {function} onCaptainSelect - Callback para seleccionar capitán (playerId)
 * @param {boolean} selectingCaptain - Si estamos en modo selección de capitán
 * @param {object} activeGameweek
 * @param {string} formation - "4-4-2", etc.
 */
export default function PitchView({ squad, onPlayerClick, onCaptainSelect, selectingCaptain, activeGameweek, formation = "4-4-2" }) {
  const starters = squad.filter(p => !p.isBenched);

  const [defCount, midCount, fwdCount] = formation.split('-').map(Number);
  const limits = { GK: 1, DEF: defCount, MID: midCount, FWD: fwdCount };

  const getPositionGroup = (pos) => {
     const players = starters.filter(p => p.playerPosition === pos);
     const needed = limits[pos] || 0;
     
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
        <div className="goal-area top"></div>
        <div className="goal-area bottom"></div>
        
        <div className="pitch-players-overlay">
           <PositionRow 
             players={getPositionGroup('FWD')} 
             onPlayerClick={onPlayerClick} 
             onCaptainSelect={onCaptainSelect}
             selectingCaptain={selectingCaptain}
             activeGameweek={activeGameweek} 
           />
           <PositionRow 
             players={getPositionGroup('MID')} 
             onPlayerClick={onPlayerClick} 
             onCaptainSelect={onCaptainSelect}
             selectingCaptain={selectingCaptain}
             activeGameweek={activeGameweek} 
           />
           <PositionRow 
             players={getPositionGroup('DEF')} 
             onPlayerClick={onPlayerClick} 
             onCaptainSelect={onCaptainSelect}
             selectingCaptain={selectingCaptain}
             activeGameweek={activeGameweek} 
           />
           <PositionRow 
             players={getPositionGroup('GK')} 
             onPlayerClick={onPlayerClick} 
             onCaptainSelect={onCaptainSelect}
             selectingCaptain={selectingCaptain}
             activeGameweek={activeGameweek} 
           />
        </div>
      </div>
    </div>
  );
}

function PositionRow({ players, onPlayerClick, onCaptainSelect, selectingCaptain, activeGameweek }) {
  return (
    <div className="pitch-row">
      {players.map(p => (
         <PlayerCard 
           key={p.playerId} 
           player={p} 
           onClick={() => selectingCaptain && !p.isDummy ? onCaptainSelect(p.playerId) : onPlayerClick(p)} 
           selectingCaptain={selectingCaptain}
           activeGameweek={activeGameweek}
         />
      ))}
    </div>
  );
}

function PlayerCard({ player, onClick, selectingCaptain, activeGameweek }) {
  if (player.isDummy) {
     return (
        <div className="fantasy-player-card dummy cursor-pointer transition drop-shadow-md" onClick={onClick}>
           <div className="jersey flex items-center justify-center font-black text-2xl">
              +
           </div>
        </div>
     );
  }

  const [firstName, lastName] = formatPlayerName(player.fullName || player.playerName);
  const hasPhoto = player.photoUrl;
  const showPts = player.points != null;
  const pts = player.points || 0;

  return (
     <div className={`fantasy-player-card group cursor-pointer relative`} onClick={onClick}>
        {/* Captain selection ring */}
        {selectingCaptain && !player.isDummy && (
          <div className="captain-selectable-ring selecting"></div>
        )}

        {/* Remove overlay (appears on hover when NOT selecting captain) */}
        {!selectingCaptain && (
          <div className="absolute inset-0 bg-red-500/80 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
             <UserMinus className="text-white" size={22} />
          </div>
        )}

        {/* Captain select overlay */}
        {selectingCaptain && (
          <div className="absolute inset-0 bg-yellow-400/20 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
             <Crown className="text-yellow-400" size={22} />
          </div>
        )}
        
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
        </div>
        <div className="player-info-box">
           <div className="player-name" style={{ whiteSpace: 'normal', lineHeight: '1.15' }}>
              {firstName}
              {lastName && <><br/>{lastName}</>}
           </div>
           {showPts && (
              <div className={`player-pts ${pts < 0 ? 'negative' : ''}`}>
                {pts > 0 ? '+' : ''}{pts}
                {player.isCaptain && <span style={{ opacity: 0.6, fontSize: '0.5rem', marginLeft: 2 }}>×2</span>}
              </div>
           )}
        </div>
     </div>
  );
}
