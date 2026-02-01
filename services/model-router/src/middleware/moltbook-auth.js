/**
 * Moltbook Identity Authentication Middleware
 * 
 * Implements "Sign in with Moltbook" for AI agent authentication.
 * Verifies identity tokens and attaches verified agent data to requests.
 */

const axios = require('axios');

const MOLTBOOK_API_BASE = 'https://moltbook.com/api/v1';
const MOLTBOOK_APP_KEY = process.env.MOLTBOOK_APP_KEY;
const APP_DOMAIN = process.env.APP_DOMAIN || 'moltbot.local';

// Cache for verified tokens (brief cache to avoid repeated verification)
const tokenCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Verify Moltbook identity token
 * 
 * @param {string} token - The identity token from X-Moltbook-Identity header
 * @returns {Promise<Object>} Verified agent data
 * @throws {Error} If token is invalid or expired
 */
async function verifyIdentityToken(token) {
  // Check cache first
  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.agent;
  }

  if (!MOLTBOOK_APP_KEY) {
    throw new Error('MOLTBOOK_APP_KEY not configured');
  }

  try {
    const response = await axios.post(
      `${MOLTBOOK_API_BASE}/agents/verify-identity`,
      {
        token,
        audience: APP_DOMAIN
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Moltbook-App-Key': MOLTBOOK_APP_KEY
        },
        timeout: 10000
      }
    );

    const data = response.data;

    if (!data.valid) {
      const error = new Error(data.error || 'Invalid identity token');
      error.code = data.code || 'INVALID_TOKEN';
      error.hint = data.hint;
      throw error;
    }

    // Cache successful verification
    tokenCache.set(token, {
      agent: data.agent,
      expiresAt: Date.now() + CACHE_TTL_MS
    });

    return data.agent;
  } catch (error) {
    if (error.response) {
      // Moltbook API returned error
      const apiError = new Error(
        error.response.data?.error || 'Identity verification failed'
      );
      apiError.code = error.response.data?.code || 'VERIFICATION_FAILED';
      apiError.status = error.response.status;
      apiError.hint = error.response.data?.hint;
      throw apiError;
    }
    throw error;
  }
}

/**
 * Express middleware for Moltbook identity verification
 * 
 * Extracts X-Moltbook-Identity header, verifies token, attaches agent to req.moltbookAgent
 */
function moltbookAuthMiddleware(options = {}) {
  const { required = true, logger } = options;

  return async (req, res, next) => {
    const identityToken = req.headers['x-moltbook-identity'];

    // If auth not required and no token provided, continue anonymously
    if (!required && !identityToken) {
      req.moltbookAgent = null;
      return next();
    }

    // If auth required but no token provided
    if (!identityToken) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'NO_IDENTITY_TOKEN',
        hint: 'Include X-Moltbook-Identity header with your Moltbook identity token. Get one at https://moltbook.com/api/v1/agents/me/identity-token'
      });
    }

    try {
      const agent = await verifyIdentityToken(identityToken);
      
      // Attach verified agent to request
      req.moltbookAgent = agent;
      
      if (logger) {
        logger.debug('Moltbook identity verified', {
          agentId: agent.id,
          agentName: agent.name,
          path: req.path
        });
      }

      next();
    } catch (error) {
      if (logger) {
        logger.warn('Moltbook identity verification failed', {
          error: error.message,
          code: error.code,
          path: req.path
        });
      }

      // Handle specific error cases
      if (error.code === 'identity_token_expired') {
        return res.status(401).json({
          success: false,
          error: 'Identity token has expired',
          code: 'TOKEN_EXPIRED',
          hint: 'Generate a new token at https://moltbook.com/api/v1/agents/me/identity-token'
        });
      }

      if (error.code === 'audience_mismatch') {
        return res.status(401).json({
          success: false,
          error: 'Token audience mismatch',
          code: 'AUDIENCE_MISMATCH',
          hint: `This token was issued for a different service. Request a token with audience: ${APP_DOMAIN}`
        });
      }

      if (error.code === 'INVALID_TOKEN' || error.status === 401) {
        return res.status(401).json({
          success: false,
          error: error.message || 'Invalid identity token',
          code: 'INVALID_TOKEN',
          hint: error.hint || 'Check your token and try again'
        });
      }

      // Internal error
      return res.status(500).json({
        success: false,
        error: 'Identity verification failed',
        code: 'VERIFICATION_ERROR',
        hint: 'Please try again later'
      });
    }
  };
}

/**
 * Optional auth middleware - allows anonymous requests
 */
function optionalMoltbookAuth(options = {}) {
  return moltbookAuthMiddleware({ ...options, required: false });
}

/**
 * Get authentication instructions URL for bots
 */
function getAuthInstructionsUrl(endpoint) {
  return `https://moltbook.com/auth.md?app=MoltbotPhilosopher&endpoint=${encodeURIComponent(endpoint)}`;
}

/**
 * Clear token cache (useful for testing)
 */
function clearTokenCache() {
  tokenCache.clear();
}

module.exports = {
  verifyIdentityToken,
  moltbookAuthMiddleware,
  optionalMoltbookAuth,
  getAuthInstructionsUrl,
  clearTokenCache
};
