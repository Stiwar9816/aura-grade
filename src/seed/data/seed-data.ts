import { UserRoles, DocumentType } from 'src/auth/enums';
import { SeedData } from 'src/interfaces';

export const SEED_DATA: SeedData = {
  rubrics: [
    {
      title: 'Rúbrica de Ensayo Académico',
      maxTotalScore: 15, // 5 + 5 + 5
      criteria: [
        {
          title: 'Ortografía',
          maxPoints: 5,
          levels: [
            { score: 5, description: 'Sin errores ortográficos.' },
            { score: 3, description: 'Algunos errores menores.' },
            { score: 1, description: 'Múltiples errores ortográficos.' },
          ],
        },
        {
          title: 'Argumentación',
          maxPoints: 5,
          levels: [
            { score: 5, description: 'Argumentos claros, lógicos y bien fundamentados.' },
            { score: 3, description: 'Argumentos presentes pero falta profundidad.' },
            { score: 1, description: 'Argumentos débiles o inexistentes.' },
          ],
        },
        {
          title: 'Estructura',
          maxPoints: 5,
          levels: [
            { score: 5, description: 'Introducción, desarrollo y conclusión bien definidos.' },
            { score: 3, description: 'Estructura básica, falta cohesión.' },
            { score: 1, description: 'Desorganizado y sin estructura clara.' },
          ],
        },
      ],
    },
    {
      title: 'Rúbrica de Proyecto de Software',
      maxTotalScore: 15,
      criteria: [
        {
          title: 'Funcionalidad',
          maxPoints: 5,
          levels: [
            { score: 5, description: 'Cumple todos los requerimientos funcionales.' },
            { score: 3, description: 'Cumple parcialmente los requerimientos.' },
            { score: 1, description: 'No funciona o falla en lo básico.' },
          ],
        },
        {
          title: 'Código Limpio',
          maxPoints: 5,
          levels: [
            { score: 5, description: 'Sigue principios SOLID y buenas prácticas.' },
            { score: 3, description: 'Código legible pero con oportunidades de mejora.' },
            { score: 1, description: 'Código difícil de leer y mantener.' },
          ],
        },
        {
          title: 'Documentación',
          maxPoints: 5,
          levels: [
            { score: 5, description: 'README completo, instalación clara y comentarios.' },
            { score: 3, description: 'Documentación básica incompleta.' },
            { score: 1, description: 'Sin documentación.' },
          ],
        },
      ],
    },
  ],
  users: [
    // Docentes
    {
      name: 'Jorge',
      last_name: 'Castro',
      email: 'jorge@aura.com',
      password: 'Password123!',
      role: UserRoles.Docente,
      document_type: DocumentType.CITIZENSHIP_CARD,
      document_num: 1000000001,
      phone: 3000000001,
    },
    {
      name: 'Ana',
      last_name: 'Lopez',
      email: 'ana@aura.com',
      password: 'Password123!',
      role: UserRoles.Docente,
      document_type: DocumentType.CITIZENSHIP_CARD,
      document_num: 1000000002,
      phone: 3000000002,
    },
    // Estudiantes
    {
      name: 'Juan',
      last_name: 'Perez',
      email: 'juan@aura.com',
      password: 'Password123!',
      role: UserRoles.Estudiante,
      document_type: DocumentType.IDENTITY_CARD,
      document_num: 2000000001,
      phone: 3100000001,
    },
    {
      name: 'Maria',
      last_name: 'Garcia',
      email: 'maria@aura.com',
      password: 'Password123!',
      role: UserRoles.Estudiante,
      document_type: DocumentType.IDENTITY_CARD,
      document_num: 2000000002,
      phone: 3100000002,
    },
    {
      name: 'Carlos',
      last_name: 'Rodriguez',
      email: 'carlos@aura.com',
      password: 'Password123!',
      role: UserRoles.Estudiante,
      document_type: DocumentType.CITIZENSHIP_CARD,
      document_num: 2000000003,
      phone: 3100000003,
    },
    {
      name: 'Laura',
      last_name: 'Martinez',
      email: 'laura@aura.com',
      password: 'Password123!',
      role: UserRoles.Estudiante,
      document_type: DocumentType.CITIZENSHIP_CARD,
      document_num: 2000000004,
      phone: 3100000004,
    },
    {
      name: 'Pedro',
      last_name: 'Sanchez',
      email: 'pedro@aura.com',
      password: 'Password123!',
      role: UserRoles.Estudiante,
      document_type: DocumentType.CITIZENSHIP_CARD,
      document_num: 2000000005,
      phone: 3100000005,
    },
    {
      name: 'Sofia',
      last_name: 'Torres',
      email: 'sofia@aura.com',
      password: 'Password123!',
      role: UserRoles.Estudiante,
      document_type: DocumentType.IDENTITY_CARD,
      document_num: 2000000006,
      phone: 3100000006,
    },
    {
      name: 'Diego',
      last_name: 'Ramirez',
      email: 'diego@aura.com',
      password: 'Password123!',
      role: UserRoles.Estudiante,
      document_type: DocumentType.IDENTITY_CARD,
      document_num: 2000000007,
      phone: 3100000007,
    },
    {
      name: 'Valentina',
      last_name: 'Hernandez',
      email: 'valentina@aura.com',
      password: 'Password123!',
      role: UserRoles.Estudiante,
      document_type: DocumentType.CITIZENSHIP_CARD,
      document_num: 2000000008,
      phone: 3100000008,
    },
  ],
};
