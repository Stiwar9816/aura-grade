import { UserRoles } from '../enums';

// Payload of creation for JWT (Json Web Token)
export interface JwtPayload {
  id: string;
  name: string;
  last_name: string;
  email: string;
  role: UserRoles;
}
