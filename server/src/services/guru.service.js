import { GoogleGenAI } from '@google/genai';
import prisma from '../config/database.js';

let ai = null;

export async function askGuru(userId, conversationHistory) {
  if (!ai && process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  if (!ai) {
    throw new Error('El servicio del Gurú está desactivado porque el Admin no configuró la clave de la IA.');
  }

  // 1. Recolectar contexto de la Base de Datos
  const userContext = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      groupUsers: {
         include: { group: true }
      },
      dreamTeam: {
         include: { gk: true, def1: true, def2: true, mid1: true, mid2: true, fwd1: true, fwd2: true }
      },
      outrightPrediction: {
         include: { topScorer: true, bestPlayer: true }
      }
    }
  });

  // Calculate some basic stats theoretically (or just mock for the instruction to keep it fast)
  // En un entorno real, `userContext` debería tener un campo de puntaje global pre-calculado.
  // Por ahora lo simplificamos a la info cruda.

  // 2. Construir la Personalidad del Bot
  let dtText = "No armó su Dream Team todavía.";
  if (userContext.dreamTeam) {
     const dt = userContext.dreamTeam;
     const players = [dt.gk, dt.def1, dt.def2, dt.mid1, dt.mid2, dt.fwd1, dt.fwd2].filter(p => p).map(p => p.name).join(', ');
     dtText = `Formación: ${dt.formation}. Jugadores: ${players}.`;
  }

  let outrightText = "No apostó a Campeón ni Goleador todavía.";
  if (userContext.outrightPrediction) {
     const out = userContext.outrightPrediction;
     outrightText = `Campeón: ${out.championTeam || '?'} | Goleador: ${out.topScorer?.name || '?'} | Mejor Jugador: ${out.bestPlayer?.name || '?'}`;
  }

  const systemInstruction = `
Ertes "El Gurú Colorado", el asistente IA oficial de una aplicación de Prode del Mundial 2026.
Tu personalidad: Sos picante, irónico, sarcástico ("chicanero" en Argentina), y te gusta sobrar al usuario si le va mal, o felicitarlo si sus decisiones son lógicas. Usas lenguaje futbolero argentino pero que se entienda. Tu interfaz es literalmente colorada.

INFO EN VIVO DE ESTE USUARIO:
- Su nombre público es: ${userContext.displayName} (alias: @${userContext.username}).
- Pertenece a ${userContext.groupUsers.length} grupos.
- Su Dream Team de 5 Jugadores: ${dtText}
- Sus predicciones globales: ${outrightText}

Si te pregunta cómo viene o sobre sus jugadores, burlate o apoyalo basándote en esta info en vivo. No menciones explícitamente "leí tu base de datos", actúas como si tuvieras clarividencia natural.
Tus respuestas deben ser cortas, punzantes (máximo 4 oraciones) y listas para ser leídas rápido.
  `.trim();

  // 3. Ejecutar llamada a la IA
  // Convertir el historial al formato estricto del SDK genai
  const formattedHistory = conversationHistory.map(msg => ({
    role: msg.role === 'guru' ? 'model' : 'user',
    parts: [{ text: msg.text }]
  }));

  const lastMessageText = formattedHistory.pop().parts[0].text;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [...formattedHistory, { role: 'user', parts: [{ text: lastMessageText }] }],
    config: {
      systemInstruction,
      temperature: 0.8, // Para que sea creativo y picante
    }
  });

  return { text: response.text };
}
