/**
 * A course in the university system (SGA) is identified by TWO codes:
 * - the group, e.g. PGINS2301QDOA (program letters + 4-digit period + campus/group letters), shared
 *   by every subject of that group;
 * - the subject inside the group, e.g. 000067 (6 digits).
 * One AuraGrade course is one subject of one group, so the pair is what grades are cross-checked
 * against the SGA with. The group is stored in `code_course`, always trimmed and upper-cased.
 */

/** Loose floor accepted by the API input (legacy courses such as NEST101 still exist). */
export const COURSE_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,29}$/;

/** Format of every group code the SGA issues; required for new or changed codes. */
export const SGA_GROUP_CODE_PATTERN = /^[A-Z]{3,8}\d{4}[A-Z]{2,6}$/;

export const SGA_SUBJECT_CODE_PATTERN = /^\d{6}$/;

export const SGA_GROUP_CODE_MESSAGE =
  'El código de grupo debe tener el formato del SGA, por ejemplo PGINS2301QDOA: letras, 4 dígitos y letras, sin espacios ni símbolos.';

export const SGA_SUBJECT_CODE_MESSAGE =
  'El código de materia debe tener 6 dígitos, por ejemplo 000067.';

export const normalizeCourseCode = (code: string): string => code.trim().toUpperCase();
