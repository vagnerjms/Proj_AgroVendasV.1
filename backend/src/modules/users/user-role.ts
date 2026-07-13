export const USER_ROLES = ['admin', 'broker', 'financial', 'accountant'] as const;

export type UserRole = (typeof USER_ROLES)[number];
