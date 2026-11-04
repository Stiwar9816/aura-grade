import { MAX_REPLY_LENGTH } from './telegram.constants';

export const HELP = [
  'Escríbeme con tus palabras, por ejemplo:',
  '«¿Qué pide la actividad 3?» o «¿Cuándo es el parcial?»',
  '',
  'O usa estos atajos:',
  '📚 /cursos – tus cursos',
  '🎯 /curso 2 – elegir el curso activo',
  '⏰ /entregas – próximas entregas',
  '📋 /actividades – todas las actividades',
  '📝 /resultado 1 – nota y comentarios de la actividad 1',
  '🔌 /desvincular – desconectar este Telegram',
  '',
  'Respondo con los documentos oficiales de tu curso e indico la página de cada dato.',
].join('\n');

export const NOT_LINKED =
  'Este Telegram no está vinculado. Entra a Aura Grade, abre Ajustes → Telegram y genera un código de vinculación.';
export const DENIED = 'No tienes acceso académico a esta consulta. Contacta con tu institución.';
export const GENERIC_ERROR = 'No pude procesar tu mensaje. Inténtalo de nuevo más tarde.';

export const truncate = (text: string) =>
  text.length <= MAX_REPLY_LENGTH ? text : `${text.slice(0, MAX_REPLY_LENGTH - 1)}…`;

const bogota = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
export const formatDate = (value: Date | string) => {
  // Build from parts: the locale's own separators vary between ICU versions.
  const p = Object.fromEntries(
    bogota.formatToParts(new Date(value)).map((part) => [part.type, part.value])
  );
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute} (Colombia)`;
};

type Course = { id: string; name: string; code?: string };
export function formatCourses(courses: Course[], selectedId?: string | null) {
  return [
    'Tus cursos:',
    ...courses.map((c, i) => `${i + 1}. ${c.name}${c.id === selectedId ? ' ✓ (activo)' : ''}`),
    'Elige uno con /curso N.',
  ].join('\n');
}

type Activity = {
  title: string;
  dueDate: Date | string;
  effectiveDueDate: Date | string;
  submission: { status: string } | null;
};
export function formatActivities(header: string, items: Activity[]) {
  if (!items.length) return `${header}\nNo hay actividades para mostrar.`;
  return [
    header,
    ...items.map((a, i) => {
      const extended = new Date(a.effectiveDueDate).getTime() !== new Date(a.dueDate).getTime();
      return `${i + 1}. ${a.title}\n   Cierre: ${formatDate(a.effectiveDueDate)}${
        extended ? ' (con tu prórroga)' : ''
      }${a.submission ? '\n   Ya la entregaste.' : ''}`;
    }),
  ].join('\n');
}

type Result = {
  assignment: { title: string };
  state: 'PUBLISHED' | 'AWAITING_PUBLICATION' | 'NOT_SUBMITTED';
  evaluation: {
    totalScore: number;
    generalFeedback?: string | null;
    criteria: { name?: string; score?: number; feedback?: string }[];
  } | null;
};
export function formatResult(result: Result) {
  const title = `Actividad: ${result.assignment.title}`;
  if (result.state === 'NOT_SUBMITTED') return `${title}\nAún no has entregado esta actividad.`;
  if (result.state === 'AWAITING_PUBLICATION' || !result.evaluation)
    return `${title}\nTu entrega fue recibida. El docente aún no ha publicado la nota.`;
  const { totalScore, generalFeedback, criteria } = result.evaluation;
  const lines = [title, `Nota: ${totalScore}`]; // zero is a valid grade
  if (generalFeedback) lines.push(`Retroalimentación: ${generalFeedback}`);
  for (const c of criteria)
    lines.push(
      `• ${c.name ?? 'Criterio'}${typeof c.score === 'number' ? `: ${c.score}` : ''}${
        c.feedback ? ` — ${c.feedback}` : ''
      }`
    );
  return lines.join('\n');
}

type Answer = {
  answer: string;
  citations: { title: string; version: number; page: number }[];
};
/** Documents are never sent through Telegram: the web viewer applies the student's session. */
export function formatAnswer(result: Answer, siteUrl: string) {
  if (!result.citations.length) return result.answer;
  const seen = new Set<string>();
  const sources = result.citations
    .filter((c) => {
      const key = `${c.title}|${c.version}|${c.page}`;
      return seen.has(key) ? false : (seen.add(key), true);
    })
    .map((c) => `• ${c.title} (v${c.version}), p. ${c.page}`);
  return [
    result.answer,
    '',
    'Fuentes:',
    ...sources,
    `Abre el documento en la web, con tu sesión: ${siteUrl}`,
  ].join('\n');
}
