import { Meteor } from 'meteor/meteor';
import jwt from 'jsonwebtoken';
import { validateToken } from './client.js';

// Cache for used nonces (in production, use Redis or MongoDB)
const usedNonces = new Set();
const NONCE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

// Clean up old nonces periodically
if (Meteor.isServer) {
  Meteor.setInterval(() => {
    // In a real implementation, nonces would have timestamps
    // For now, we just clear the set periodically
    if (usedNonces.size > 10000) {
      usedNonces.clear();
    }
  }, 5 * 60 * 1000); // Every 5 minutes
}

/**
 * Validate an SSO token from the Hub
 * @param {string} token - The JWT token from the Hub
 * @returns {Object} - Validation result with user data or error
 */
export async function validateSsoToken(token) {
  if (!token) {
    return { valid: false, error: 'no_token' };
  }
  
  const publicKey = Meteor.settings.private?.hubPublicKey;
  const expectedAppId = Meteor.settings.public?.appId;
  
  if (!publicKey) {
    console.error('Hub public key not configured');
    return { valid: false, error: 'configuration_error' };
  }
  
  try {
    // Verify the token signature and decode it
    const decoded = jwt.verify(token, publicKey, {
      algorithms: ['RS256']
    });
    
    // Check if token is for this app
    if (expectedAppId && decoded.appId !== expectedAppId) {
      console.warn(`Token appId mismatch: expected ${expectedAppId}, got ${decoded.appId}`);
      return { valid: false, error: 'wrong_app' };
    }
    
    // Check nonce hasn't been used (prevent replay attacks)
    if (decoded.nonce) {
      if (usedNonces.has(decoded.nonce)) {
        console.warn('Nonce already used:', decoded.nonce);
        return { valid: false, error: 'nonce_reused' };
      }
      usedNonces.add(decoded.nonce);
    }
    
    // Optionally validate with Hub API for fresh data
    // This is recommended but not required if token is valid
    try {
      const hubValidation = await validateToken(token);
      if (hubValidation.valid === false) {
        return { valid: false, error: hubValidation.error || 'hub_validation_failed' };
      }
      
      // Use fresh data from Hub if available
      return {
        valid: true,
        userId: hubValidation.userId || decoded.userId,
        username: hubValidation.username || decoded.username,
        email: hubValidation.email || decoded.email,
        subscriptions: hubValidation.subscriptions || decoded.subscriptions || []
      };
    } catch (hubError) {
      // Hub API call failed, but token signature is valid
      // Use data from token (acceptable for short-term access)
      console.warn('Hub API validation failed, using token data:', hubError.message);
      
      return {
        valid: true,
        userId: decoded.userId,
        username: decoded.username,
        email: decoded.email,
        subscriptions: decoded.subscriptions || []
      };
    }
    
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return { valid: false, error: 'token_expired' };
    }
    if (error.name === 'JsonWebTokenError') {
      return { valid: false, error: 'invalid_signature' };
    }
    
    console.error('SSO token validation error:', error);
    return { valid: false, error: 'validation_error' };
  }
}

/**
 * Extract token from URL query string (client-side)
 */
export function getTokenFromUrl() {
  if (Meteor.isServer) return null;
  
  const params = new URLSearchParams(window.location.search);
  return params.get('token');
}
