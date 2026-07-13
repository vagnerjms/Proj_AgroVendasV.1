import { UserRole } from '../../users/user-role';

export type AuthenticatedUser = {
  sub: string;
  email: string;
  role: UserRole;
  name?: string;
};
