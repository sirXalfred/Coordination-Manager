import { Request, Response, NextFunction } from 'express'

export class ApplicationError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends ApplicationError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR')
  }
}

export class UnauthorizedError extends ApplicationError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED')
  }
}

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const isExpectedMissingToken =
    error instanceof UnauthorizedError &&
    error.message === 'Missing authentication token'

  if (isExpectedMissingToken) {
    // Common unauthenticated probe traffic should not emit noisy stack traces.
    console.warn('Auth warning:', {
      message: error.message,
      path: req.path,
      method: req.method,
    })
  } else {
    console.error('Error:', {
      message: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
    })
  }

  if (error instanceof ApplicationError) {
    return res.status(error.statusCode).json({
      error: error.code,
      message: error.message,
      statusCode: error.statusCode,
    })
  }

  // Forward status code from Express built-in errors (e.g. PayloadTooLargeError)
  const statusCode = (error as { status?: number; statusCode?: number }).status || (error as { status?: number; statusCode?: number }).statusCode || 500
  const isClientError = statusCode >= 400 && statusCode < 500
  return res.status(statusCode).json({
    error: statusCode === 413 ? 'PAYLOAD_TOO_LARGE' : (isClientError ? 'BAD_REQUEST' : 'INTERNAL_SERVER_ERROR'),
    message: isClientError ? error.message : 'An unexpected error occurred',
    statusCode,
  })
}
