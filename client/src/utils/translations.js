/**
 * Traducciones de nombres de países, estados de partidos, y labels comunes.
 * Los nombres de equipos NO se traducen (son nombres propios).
 */

const COUNTRY_NAMES = {
  England: "Inglaterra",
  Germany: "Alemania",
  France: "Francia",
  Spain: "España",
  Italy: "Italia",
  Netherlands: "Países Bajos",
  Portugal: "Portugal",
  Brazil: "Brasil",
  Argentina: "Argentina",
  Uruguay: "Uruguay",
  Colombia: "Colombia",
  Chile: "Chile",
  Mexico: "México",
  "United States": "Estados Unidos",
  Japan: "Japón",
  "South Korea": "Corea del Sur",
  Australia: "Australia",
  "Saudi Arabia": "Arabia Saudita",
  Qatar: "Catar",
  Morocco: "Marruecos",
  Senegal: "Senegal",
  Nigeria: "Nigeria",
  Cameroon: "Camerún",
  Ghana: "Ghana",
  Tunisia: "Túnez",
  Egypt: "Egipto",
  Algeria: "Argelia",
  Poland: "Polonia",
  Belgium: "Bélgica",
  Croatia: "Croacia",
  Serbia: "Serbia",
  Switzerland: "Suiza",
  Denmark: "Dinamarca",
  Sweden: "Suecia",
  Norway: "Noruega",
  "Czech Republic": "República Checa",
  Austria: "Austria",
  Hungary: "Hungría",
  Greece: "Grecia",
  Turkey: "Turquía",
  Romania: "Rumanía",
  Scotland: "Escocia",
  Wales: "Gales",
  Ireland: "Irlanda",
  "Northern Ireland": "Irlanda del Norte",
  Iceland: "Islandia",
  Finland: "Finlandia",
  Russia: "Rusia",
  Ukraine: "Ucrania",
  China: "China",
  India: "India",
  Iran: "Irán",
  Iraq: "Irak",
  "Costa Rica": "Costa Rica",
  Panama: "Panamá",
  Honduras: "Honduras",
  Ecuador: "Ecuador",
  Peru: "Perú",
  Bolivia: "Bolivia",
  Paraguay: "Paraguay",
  Venezuela: "Venezuela",
  Canada: "Canadá",
  Jamaica: "Jamaica",
  World: "Mundial",
  Europe: "Europa",
  "South-America": "Sudamérica",
  "North-America": "Norteamérica",
  Asia: "Asia",
  Africa: "África",
  Oceania: "Oceanía",
};

const MATCH_STATUS = {
  "Not Started": "Por jugar",
  "Match Finished": "Finalizado",
  "First Half": "Primer Tiempo",
  "Second Half": "Segundo Tiempo",
  Halftime: "Entretiempo",
  "Extra Time": "Tiempo Extra",
  "Penalty In Progress": "Penales",
  "Match Suspended": "Suspendido",
  "Match Postponed": "Postergado",
  "Match Cancelled": "Cancelado",
  "Match Abandoned": "Abandonado",
  "Technical Loss": "Pérdida Técnica",
  Walkover: "Walkover",
  "In Progress": "En Juego",
};

const STAT_LABELS = {
  "Shots on Goal": "Tiros al arco",
  "Shots off Goal": "Tiros afuera",
  "Total Shots": "Tiros totales",
  "Blocked Shots": "Tiros bloqueados",
  "Shots insidebox": "Tiros dentro del área",
  "Shots outsidebox": "Tiros fuera del área",
  Fouls: "Faltas",
  "Corner Kicks": "Córners",
  Offsides: "Fuera de juego",
  "Ball Possession": "Posesión",
  "Yellow Cards": "Tarjetas amarillas",
  "Red Cards": "Tarjetas rojas",
  "Goalkeeper Saves": "Atajadas",
  "Total passes": "Pases totales",
  "Passes accurate": "Pases precisos",
  "Passes %": "% Pases",
  expected_goals: "Goles esperados (xG)",
};

const EVENT_TYPES = {
  Goal: "Gol",
  Card: "Tarjeta",
  subst: "Cambio",
  Var: "VAR",
  "Normal Goal": "Gol",
  "Own Goal": "Gol en contra",
  Penalty: "Penal",
  "Missed Penalty": "Penal errado",
  "Yellow Card": "Amarilla",
  "Red Card": "Roja",
  "Second Yellow card": "Segunda amarilla",
  "Substitution 1": "Cambio",
};

const ROUND_LABELS = {
  "Regular Season": "Fecha",
  "Group Stage": "Fase de Grupos",
  "Round of 32": "16avos de Final",
  "Round of 16": "Octavos de Final",
  "Quarter-finals": "Cuartos de Final",
  "Semi-finals": "Semifinal",
  Final: "Final",
  "3rd Place Final": "Tercer Puesto",
  "Preliminary Round": "Ronda Preliminar",
  Qualification: "Clasificación",
  "Play-offs": "Repechaje",
  "Knockout Round Play-offs": "Repechaje KO",
};

const MARKET_NAMES = {
  "Match Winner": "Ganador del Partido",
  "Match Winner & Both Teams To Score": "Ganador y Ambos Anotan",
  "Second Half Winner": "Ganador 2do Tiempo",
  "First Half Winner": "Ganador 1er Tiempo",
  "Match Corners": "Tiros de Esquina",
  "Away Team Goals": "Goles Visitante",
  "Home Team Goals": "Goles Local",
  "Total Shots": "Tiros Totales",
  "Away Team Clean Sheet": "Arco en Cero (Visita)",
  "Home Team Clean Sheet": "Arco en Cero (Local)",
  "Race to the 5th corner?": "1ro a 5 Córners",
  "Race to the 3rd corner?": "1ro a 3 Córners",
  "3-Way Handicap": "Hándicap (3 Vías)",
  "Asian Handicap": "Hándicap Asiático",
  "To Score 3 or More": "Anotar 3 o Más",
  "Final Score": "Resultado Exacto",
  "Match Goals": "Goles del Partido",
  "Over/Under Line": "Alta / Baja (Línea)",
  "Over/Under": "Más de / Menos de",
  "Both Teams Score": "Ambos Anotan",
  "Clean Sheet - Home": "Arco en Cero - Local",
  "Clean Sheet - Away": "Arco en Cero - Visita",
  "Double Chance": "Doble Oportunidad",
  "Draw No Bet": "Empate No Válido",
  "Half Time / Full Time": "1er Tiempo / Final",
  "Which Team to Score": "¿Qué Equipo Anotará?",
};

const ODDS_VALUES = {
  Over: "Más de",
  Under: "Menos de",
  Exactly: "Exactamente",
  Home: "Local",
  Away: "Visita",
  Draw: "Empate",
  Yes: "Sí",
  No: "No",
  Neither: "Ninguno",
  "Home/Home": "Local/Local",
  "Home/Draw": "Local/Empate",
  "Home/Away": "Local/Visita",
  "Draw/Home": "Empate/Local",
  "Draw/Draw": "Empate/Empate",
  "Draw/Away": "Empate/Visita",
  "Away/Home": "Visita/Local",
  "Away/Draw": "Visita/Empate",
  "Away/Away": "Visita/Visita",
};

/** Traduce un nombre de país */
export function tCountry(name) {
  return COUNTRY_NAMES[name] || name;
}

/** Traduce un estado de partido */
export function tStatus(status) {
  return MATCH_STATUS[status] || status;
}

/** Traduce una etiqueta de stat */
export function tStat(stat) {
  return STAT_LABELS[stat] || stat;
}

/** Traduce un tipo de evento */
export function tEvent(type) {
  return EVENT_TYPES[type] || type;
}

/** Traduce una ronda/fecha */
export function tRound(round) {
  if (!round) return "";
  // "Regular Season - 15" → "Fecha 15"
  for (const [eng, esp] of Object.entries(ROUND_LABELS)) {
    if (round.startsWith(eng)) {
      const suffix = round.replace(eng, "").trim();
      return suffix ? `${esp} ${suffix.replace("- ", "")}` : esp;
    }
  }
  return round;
}

/** Traduce un mercado de apuestas */
export function tMarket(name) {
  return MARKET_NAMES[name] || name;
}

/** Traduce un valor de apuesta */
export function tOddValue(value) {
  // If it's a number/score like "1-0" or "Inter Miami", don't format it.
  return ODDS_VALUES[value] || value;
}

// ═══════════════════════════════════════
// INJURIES / ABSENCES
// ═══════════════════════════════════════

const INJURY_REASONS = {
  // Lesiones musculares
  Injury: "Lesión",
  "Muscle Injury": "Lesión muscular",
  "Calf Injury": "Lesión en la pantorrilla",
  "Hamstring Injury": "Lesión en el isquiotibial",
  "Thigh Injury": "Lesión en el muslo",
  "Groin Injury": "Lesión en la ingle",
  "Hip Injury": "Lesión en la cadera",
  "Back Injury": "Lesión en la espalda",
  "Neck Injury": "Lesión en el cuello",
  "Adductor Injury": "Lesión en el aductor",
  "Abductor Injury": "Lesión en el abductor",
  "Quadriceps Injury": "Lesión en el cuádriceps",

  // Articulaciones
  "Knee Injury": "Lesión en la rodilla",
  "Ankle Injury": "Lesión en el tobillo",
  "Foot Injury": "Lesión en el pie",
  "Shoulder Injury": "Lesión en el hombro",
  "Elbow Injury": "Lesión en el codo",
  "Wrist Injury": "Lesión en la muñeca",
  "Finger Injury": "Lesión en el dedo",

  // Tendones y ligamentos
  "Achilles Tendon Injury": "Lesión en el tendón de Aquiles",
  "Tendon Injury": "Lesión en el tendón",
  "Ligament Injury": "Lesión de ligamento",
  "ACL Injury": "Lesión de ligamento cruzado",
  "MCL Injury": "Lesión de ligamento colateral",
  "Meniscus Injury": "Lesión de menisco",
  "Cruciate Ligament Injury": "Rotura de ligamento cruzado",
  "Cruciate Ligament Rupture": "Rotura de ligamento cruzado",

  // Huesos
  Fracture: "Fractura",
  "Broken Leg": "Fractura de pierna",
  "Broken Arm": "Fractura de brazo",
  "Broken Nose": "Fractura de nariz",
  "Broken Jaw": "Fractura de mandíbula",
  "Broken Toe": "Fractura de dedo del pie",
  "Broken Foot": "Fractura de pie",
  "Broken Rib": "Fractura de costilla",
  "Broken Collarbone": "Fractura de clavícula",
  "Broken Cheekbone": "Fractura de pómulo",

  // Cirugías y recuperación
  Surgery: "Cirugía",
  "Post-Surgery": "Post-cirugía",
  Recovery: "Recuperación",
  Rehabilitation: "Rehabilitación",

  // Otros tipos de lesión
  Concussion: "Conmoción cerebral",
  "Head Injury": "Lesión en la cabeza",
  "Eye Injury": "Lesión en el ojo",
  "Rib Injury": "Lesión costal",
  "Facial Injury": "Lesión facial",
  "Dental Injury": "Lesión dental",
  "Spinal Injury": "Lesión espinal",
  "Pelvic Injury": "Lesión pélvica",
  "Heel Injury": "Lesión en el talón",
  "Shin Injury": "Lesión en la espinilla",
  "Fibula Injury": "Lesión en el peroné",
  "Metatarsal Injury": "Lesión en el metatarso",

  // General
  Knock: "Golpe",
  Bruise: "Contusión",
  Sprain: "Esguince",
  Strain: "Distensión",
  Dislocation: "Dislocación",
  Inflammation: "Inflamación",
  Swollen: "Hinchazón",
  Fitness: "Baja forma física",
  Illness: "Enfermedad",
  Flu: "Gripe",
  Virus: "Virus",
  Covid: "COVID",
  Fever: "Fiebre",
  "Heart Condition": "Problema cardíaco",

  // Disciplina y estado
  "Yellow Cards": "Acum. amarillas",
  "Red Card": "Tarjeta roja",
  Suspended: "Suspendido",
  Suspension: "Suspensión",
  Banned: "Sancionado",
  "Domestic Suspension": "Suspensión doméstica",
  "International Duty": "Selección nacional",
  Rest: "Descanso",
  "Personal Reasons": "Motivos personales",
  "Family Reasons": "Motivos familiares",
  "Lack of match fitness": "Falta de ritmo",
  "Not in squad": "Fuera de la convocatoria",
  "Coaching Staff Decision": "Decisión técnica",
  "Manager Decision": "Decisión del DT",
  Transfer: "Transferencia",
  "On loan": "A préstamo",
  "Training Injury": "Lesión en entrenamiento",
  "Match Injury": "Lesión en partido",
  Unknown: "Desconocido",
  Inactive: "Inactivo",
  "Missing Fixture": "Ausente",
  Questionable: "En duda",
  Doubtful: "Dudoso",
  Out: "Baja",
};

/** Traduce un motivo de lesión / ausencia */
export function tInjury(reason) {
  if (!reason) return "";
  // Intentar match exacto primero
  if (INJURY_REASONS[reason]) return INJURY_REASONS[reason];
  // Intentar match parcial (la API a veces envía "Muscle Injury (14 days)")
  const cleanReason = reason.split("(")[0].trim();
  if (INJURY_REASONS[cleanReason]) return INJURY_REASONS[cleanReason];
  // Si no hay traducción, devolver el original
  return reason;
}
