import { MikroORM } from '@mikro-orm/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
/**
 * E2E Tests for AppController
 *
 * Tests the following endpoints:
 * - GET /health - Database-aware health check
 */
import { AppController } from './app.controller'
import { initializeTestApp } from './test/helpers/test-app.helper'
import { createRequest } from './test/helpers/test-auth.helper'

describe('appController (e2e)', () => {
  beforeEach(async (context) => {
    const { app } = await initializeTestApp(
      { orm: context.orm },
      {
        controllers: [AppController],
      },
    )
    context.app = app
    context.request = createRequest(app)
  })

  describe('gET /health', () => {
    it('should answer 200 without a session when the database is reachable', async (context) => {
      const { request } = context

      // Act
      const response = await request.get('/health')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toEqual({ status: 'ok' })
    })

    it('should answer 503 when the database is unreachable', async (context) => {
      const { app, request } = context
      // Arrange
      vi.spyOn(app.get(MikroORM).em.getConnection(), 'execute').mockRejectedValue(
        new Error('connection refused'),
      )

      // Act
      const response = await request.get('/health')

      // Assert
      expect(response.status).toBe(503)
    })
  })
})
