import type { Auth } from 'better-auth'
import type { AuthModuleOptions } from './auth.definition'
import { Inject } from '@nestjs/common'
import {
  MODULE_OPTIONS_TOKEN,
} from './auth.definition'

/**
 * NestJS service that provides access to the Better Auth instance
 * Use generics to support auth instances extended by plugins
 */
export class AuthService<T extends { api: T['api'] } = Auth> {
  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions<T>,
  ) {}

  /**
   * Returns the API endpoints provided by the auth instance
   */
  get api(): T['api'] {
    return this.options.auth.api
  }

  /**
   * Returns the complete auth instance
   * Access this for plugin-specific functionality
   */
  get instance(): T {
    return this.options.auth
  }
}
