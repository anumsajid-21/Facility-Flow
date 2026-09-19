import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route to the given roles.
 * Roles: HIRING_ORG | PROVIDER | ADMIN
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);