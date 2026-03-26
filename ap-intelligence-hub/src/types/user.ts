export type UserRole = 'AP_AGENT' | 'AP_REVIEWER' | 'SUPER_ADMIN';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: UserRole;
  department: string;
  isActive: boolean;
  approvalLimit?: number;
  lastLoginAt: string;
  createdAt: string;
}

export interface Session {
  user: User;
  token: string;
  expiresAt: string;
}
