/**
 * LuxeReserve - Error Handling Utilities
 * Standardized error classes and response format
 */

// Custom error class with status code, error code, and message
class AppError extends Error {
  constructor(statusCode, code, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }
}

// Pre-defined error types
const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  OPTIMISTIC_LOCK: 'OPTIMISTIC_LOCK',
  RATE_LIMIT: 'RATE_LIMIT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DEPENDENCY_ERROR: 'DEPENDENCY_ERROR',
};

function errorResponse(res, err) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  }

  // Fallback for unexpected errors
  console.error('[ERROR] Unhandled:', err);
  return res.status(500).json({
    success: false,
    error: {
      code: ErrorCodes.INTERNAL_ERROR,
      message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    },
  });
}

/**
 * Transaction retry helper
 * Retries a transaction callback up to `maxRetries` times with exponential backoff
 * when deadlock (1205) or other transient errors occur.
 */
async function executeWithRetry(pool, callback, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const transaction = new (require('mssql').Transaction)(pool);
      await transaction.begin();
      
      try {
        const result = await callback(transaction);
        await transaction.commit();
        return result;
      } catch (txErr) {
        try { await transaction.rollback(); } catch (_) { /* ignore rollback failure */ }
        throw txErr;
      }
    } catch (err) {
      lastError = err;
      
      // Check for deadlock (SQL error 1205) or serialization (1200)
      const isTransient = err.number === 1205 || err.number === 1200 || err.code === 'EREQUEST';
      
      if (isTransient && attempt < maxRetries) {
        const delay = Math.min(100 * Math.pow(2, attempt - 1), 2000); // 100ms, 200ms, 400ms
        console.warn(`[Retry] Transaction attempt ${attempt} failed (${err.message}). Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw err;
    }
  }
  
  throw lastError;
}

module.exports = {
  AppError,
  ErrorCodes,
  errorResponse,
  executeWithRetry,
};
