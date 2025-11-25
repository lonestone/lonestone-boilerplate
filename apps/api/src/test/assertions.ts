import { Response } from 'supertest'

export function expectPaginatedResponse(
  response: Response,
  expectedLength: number,
) {
  expect(response.body.data).toHaveLength(expectedLength)
  expect(response.body.meta).toMatchObject({
    pageSize: expect.any(Number),
    offset: expect.any(Number),
    hasMore: expect.any(Boolean),
  })
}

export function expectErrorResponse(
  response: Response,
  statusCode: number,
  messageContains?: string,
) {
  expect(response.status).toBe(statusCode)
  if (messageContains) {
    expect(response.body.message).toContain(messageContains)
  }
}
