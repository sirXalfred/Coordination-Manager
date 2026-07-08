import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  ApplicationError,
  ValidationError,
  UnauthorizedError,
  errorHandler,
} from '../error-handler.js'

// ---------------------------------------------------------------------------
// Error Classes
// ---------------------------------------------------------------------------

describe('ApplicationError', () => {
  it('creates error with default statusCode 500', () => {
    const err = new ApplicationError('Something broke')
    expect(err.message).toBe('Something broke')
    expect(err.statusCode).toBe(500)
    expect(err.code).toBeUndefined()
    expect(err.name).toBe('ApplicationError')
    expect(err).toBeInstanceOf(Error)
  })

  it('accepts custom statusCode and code', () => {
    const err = new ApplicationError('Not found', 404, 'NOT_FOUND')
    expect(err.statusCode).toBe(404)
    expect(err.code).toBe('NOT_FOUND')
  })

  it('has a stack trace', () => {
    const err = new ApplicationError('test')
    expect(err.stack).toBeDefined()
  })
})

describe('ValidationError', () => {
  it('creates error with statusCode 400 and VALIDATION_ERROR code', () => {
    const err = new ValidationError('Title is required')
    expect(err.message).toBe('Title is required')
    expect(err.statusCode).toBe(400)
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(err.name).toBe('ValidationError')
    expect(err).toBeInstanceOf(ApplicationError)
  })
})

describe('UnauthorizedError', () => {
  it('creates error with statusCode 401 and default message', () => {
    const err = new UnauthorizedError()
    expect(err.message).toBe('Unauthorized')
    expect(err.statusCode).toBe(401)
    expect(err.code).toBe('UNAUTHORIZED')
    expect(err.name).toBe('UnauthorizedError')
  })

  it('accepts custom message', () => {
    const err = new UnauthorizedError('Token expired')
    expect(err.message).toBe('Token expired')
    expect(err.statusCode).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// errorHandler middleware
// ---------------------------------------------------------------------------

describe('errorHandler', () => {
  let mockRes: {
    status: ReturnType<typeof vi.fn>
    json: ReturnType<typeof vi.fn>
  }
  let mockReq: { path: string; method: string }

  beforeEach(() => {
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    }
    mockReq = { path: '/test', method: 'POST' }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('handles ApplicationError with correct status and body', () => {
    const err = new ApplicationError('Service unavailable', 503, 'SERVICE_DOWN')

    errorHandler(err, mockReq as never, mockRes as never, vi.fn())

    expect(mockRes.status).toHaveBeenCalledWith(503)
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'SERVICE_DOWN',
      message: 'Service unavailable',
      statusCode: 503,
    })
  })

  it('handles ValidationError', () => {
    const err = new ValidationError('Invalid email')

    errorHandler(err, mockReq as never, mockRes as never, vi.fn())

    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'VALIDATION_ERROR',
      message: 'Invalid email',
      statusCode: 400,
    })
  })

  it('handles UnauthorizedError', () => {
    const err = new UnauthorizedError()

    errorHandler(err, mockReq as never, mockRes as never, vi.fn())

    expect(mockRes.status).toHaveBeenCalledWith(401)
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'UNAUTHORIZED',
      message: 'Unauthorized',
      statusCode: 401,
    })
  })

  it('handles PayloadTooLargeError (status 413)', () => {
    const err = Object.assign(new Error('request entity too large'), { status: 413 })

    errorHandler(err, mockReq as never, mockRes as never, vi.fn())

    expect(mockRes.status).toHaveBeenCalledWith(413)
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'PAYLOAD_TOO_LARGE',
      message: 'request entity too large',
      statusCode: 413,
    })
  })

  it('handles generic client errors (4xx) with original message', () => {
    const err = Object.assign(new Error('Bad request data'), { status: 422 })

    errorHandler(err, mockReq as never, mockRes as never, vi.fn())

    expect(mockRes.status).toHaveBeenCalledWith(422)
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'BAD_REQUEST',
      message: 'Bad request data',
      statusCode: 422,
    })
  })

  it('hides message for unknown server errors (5xx)', () => {
    const err = new Error('Database password leaked in query')

    errorHandler(err, mockReq as never, mockRes as never, vi.fn())

    expect(mockRes.status).toHaveBeenCalledWith(500)
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      statusCode: 500,
    })
  })

  it('logs the error details', () => {
    const err = new Error('test error')

    errorHandler(err, mockReq as never, mockRes as never, vi.fn())

    expect(console.error).toHaveBeenCalledWith('Error:', expect.objectContaining({
      message: 'test error',
      path: '/test',
      method: 'POST',
    }))
  })

  it('downgrades missing-token unauthorized logs to warning without stack', () => {
    const err = new UnauthorizedError('Missing authentication token')
    const errorSpy = vi.mocked(console.error)
    const warnSpy = vi.mocked(console.warn)
    errorSpy.mockClear()
    warnSpy.mockClear()

    errorHandler(err, mockReq as never, mockRes as never, vi.fn())

    expect(warnSpy).toHaveBeenCalledWith('Auth warning:', expect.objectContaining({
      message: 'Missing authentication token',
      path: '/test',
      method: 'POST',
    }))
    expect(errorSpy).not.toHaveBeenCalled()
  })
})
