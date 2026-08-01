import { t, getLocale } from './i18n.js';

export class AppError extends Error {
  constructor(key, params = {}, status = 400) {
    super(key);
    this.name = 'AppError';
    this.errorKey = key;
    this.errorParams = params;
    this.status = status;
  }
}

export function sendError(req, res, status, key, params = {}) {
  return res.status(status).json({
    error: t(getLocale(req), key, params),
    errorKey: key,
    errorParams: params,
  });
}

export function errorPayload(req, err) {
  if (err instanceof AppError) {
    return {
      error: t(getLocale(req), err.errorKey, err.errorParams),
      errorKey: err.errorKey,
      errorParams: err.errorParams,
    };
  }
  return {
    error: t(getLocale(req), 'server.internal'),
    errorKey: 'server.internal',
    errorParams: {},
  };
}

export function respondError(req, res, err, status = 500) {
  const code = err instanceof AppError ? err.status : status;
  return res.status(code).json(errorPayload(req, err));
}

export function errorMiddleware(err, req, res, _next) {
  const code = err instanceof AppError ? err.status : 500;
  return res.status(code).json(errorPayload(req, err));
}
