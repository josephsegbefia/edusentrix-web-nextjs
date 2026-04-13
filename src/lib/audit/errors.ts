export class AuditPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuditPolicyError";
  }
}

export class AuditValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuditValidationError";
  }
}

export class AuditStreamConflictError extends Error {
  constructor(message = "Audit stream head changed; retry") {
    super(message);
    this.name = "AuditStreamConflictError";
  }
}

export class AuditWriteDeadLetterError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "AuditWriteDeadLetterError";
  }
}
