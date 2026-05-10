export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class IngestionError extends AppError {
  constructor(message: string) {
    super(422, 'INGESTION_FAILED', message);
  }
}

export class AgentError extends AppError {
  constructor(message: string) {
    super(500, 'AGENT_ERROR', message);
  }
}

export class SessionNotFoundError extends AppError {
  constructor(id: string) {
    super(404, 'SESSION_NOT_FOUND', `Session ${id} not found`);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, 'VALIDATION_ERROR', message);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string) {
    super(429, 'RATE_LIMITED', message);
  }
}
