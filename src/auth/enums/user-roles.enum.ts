import { registerEnumType } from '@nestjs/graphql';

// Enum Valid roles users
export enum UserRoles {
  Administrador = 'Administrador',
  Estudiante = 'Estudiante',
  Docente = 'Docente',
}

registerEnumType(UserRoles, {
  name: 'UserRoles',
  description: 'Roles allowed in the system [Administrador, Estudiante, Docente]',
});
