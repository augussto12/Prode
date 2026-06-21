const LOCKOUT_MINUTES = 5;
const NOT_STARTED_STATUS_SHORTS = new Set(["NS", "TBD", "PST"]);

export function getMatchTimestamp(match) {
  const raw = match?.matchDate || match?.date;
  if (!raw) return null;

  const timestamp = new Date(raw).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function isMatchStarted(match, now = new Date()) {
  const status = String(match?.status || "").toUpperCase();
  if (status === "LIVE" || status === "FINISHED") return true;

  const statusShort = String(match?.statusShort || "").toUpperCase();
  if (statusShort && !NOT_STARTED_STATUS_SHORTS.has(statusShort)) return true;

  const timestamp = getMatchTimestamp(match);
  return timestamp !== null && now.getTime() >= timestamp;
}

export function getPredictionVisibilityCutoff(match) {
  const window = match?.predictionWindow;
  if (window?.phaseRule && window.closesAt) {
    const timestamp = new Date(window.closesAt).getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
  }

  const timestamp = getMatchTimestamp(match);
  if (timestamp === null) return null;
  return timestamp - LOCKOUT_MINUTES * 60 * 1000;
}

export function canViewGroupPredictions(match, now = new Date()) {
  if (!match) return false;
  if (isMatchStarted(match, now)) return true;

  const cutoff = getPredictionVisibilityCutoff(match);
  if (cutoff === null || now.getTime() < cutoff) return false;

  const window = match.predictionWindow;
  if (window?.phaseRule) {
    if (window.previousFinished === false) return false;
    if (window.canPredict === false && !window.closesAt) return false;
  }

  return true;
}

export function getGroupPredictionsAvailabilityLabel(match, now = new Date()) {
  if (!canViewGroupPredictions(match, now)) {
    return "Disponible al empezar";
  }

  if (String(match?.status || "").toUpperCase() === "FINISHED") {
    return "Ver resultados del grupo";
  }

  if (isMatchStarted(match, now)) {
    return "Ver predicciones en vivo";
  }

  return "Predicciones cerradas";
}
