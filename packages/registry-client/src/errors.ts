export class RegistryError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    message: string,
    status: number,
    code: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "RegistryError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class RegistryAuthError extends RegistryError {
  constructor(message?: string, details?: unknown) {
    super(message ?? "Authentication required", 401, "UNAUTHORIZED", details);
    this.name = "RegistryAuthError";
  }
}

export class RegistryNotFoundError extends RegistryError {
  constructor(message?: string, details?: unknown) {
    super(message ?? "Resource not found", 404, "NOT_FOUND", details);
    this.name = "RegistryNotFoundError";
  }
}
