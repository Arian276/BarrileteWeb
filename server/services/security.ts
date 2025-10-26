import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';


const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const ENCRYPTION_KEY_TTL = 5 * 60 * 1000; 
const MAX_CONCURRENT_SESSIONS = 3;


const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const sessionStore = new Map<string, { fingerprint: string; lastAccess: number; keyAccess: number }>();

export interface SecurityConfig {
  maxRequestsPerMinute: number;
  allowedReferrers: string[];
  allowedUserAgents: RegExp[];
  allowedIPs?: string[];
  geoBlockCountries?: string[];
}

export class SecurityService {
  private config: SecurityConfig;
  private activeKeys = new Map<string, { key: Buffer; expires: number; sessionId: string }>();

  constructor(config: SecurityConfig) {
    this.config = config;
    this.startKeyRotation();
  }

  generateSessionToken(req: Request): string {
    const fingerprint = this.generateFingerprint(req);
    const sessionId = crypto.randomUUID();

    const payload = {
      sessionId,
      fingerprint,
      ip: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
      timestamp: Date.now(),
      permissions: ['stream_access', 'key_access']
    };

    sessionStore.set(sessionId, {
      fingerprint,
      lastAccess: Date.now(),
      keyAccess: 0
    });

    return jwt.sign(payload, JWT_SECRET, { 
      expiresIn: '1h',
      issuer: 'Barrilete-Cosmico-Security',
      audience: 'espn-premium-hd'
    });
  }

  validateSessionToken(req: Request): { valid: boolean; sessionId?: string; reason?: string } {
    try {
      const token = this.extractToken(req);
      if (!token) {
        return { valid: false, reason: 'No token provided' };
      }

      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const currentFingerprint = this.generateFingerprint(req);

      if (decoded.fingerprint !== currentFingerprint) {
        return { valid: false, reason: 'Fingerprint mismatch' };
      }

      const session = sessionStore.get(decoded.sessionId);
      if (!session) {
        return { valid: false, reason: 'Session not found' };
      }

      session.lastAccess = Date.now();
      sessionStore.set(decoded.sessionId, session);

      return { valid: true, sessionId: decoded.sessionId };
    } catch {
      return { valid: false, reason: 'Invalid token' };
    }
  }

  checkRateLimit(req: Request): { allowed: boolean; retryAfter?: number } {
    const clientId = this.getClientIdentifier(req);
    const now = Date.now();
    const windowMs = 60 * 1000;

    const record = rateLimitStore.get(clientId) || { count: 0, resetTime: now + windowMs };

    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
    } else {
      record.count++;
    }

    rateLimitStore.set(clientId, record);

    if (record.count > this.config.maxRequestsPerMinute) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      return { allowed: false, retryAfter };
    }

    return { allowed: true };
  }

  validateReferrer(req: Request): boolean {
    const referrer = req.get('Referer') || req.get('Origin');
    if (!referrer) {
      const userAgent = req.get('User-Agent') || '';
      const isBrowserRequest = /Mozilla\/5\.0.*(Chrome|Firefox|Safari|Edge)/i.test(userAgent);
      if (isBrowserRequest && this.config.allowedReferrers.length > 0) {
        return true;
      } else if (this.config.allowedReferrers.length > 0) {
        return false;
      }
    }

    if (referrer) {
      const isAllowed = this.config.allowedReferrers.some(allowed => 
        referrer.startsWith(allowed) || referrer.includes(allowed)
      );
      if (!isAllowed) {
        return false;
      }
    }

    return true;
  }

  validateUserAgent(req: Request): boolean {
    const userAgent = req.get('User-Agent') || '';
    const blockedPatterns = [
      /bot/i, /crawler/i, /spider/i, /scraper/i, /wget/i, /curl/i,
      /python/i, /nodejs/i, /java/i, /php/i, /perl/i, /ruby/i,
      /ffmpeg/i, /vlc/i, /mpv/i
    ];

    const isBlocked = blockedPatterns.some(pattern => pattern.test(userAgent));
    if (isBlocked) return false;

    if (this.config.allowedUserAgents.length > 0) {
      const isAllowed = this.config.allowedUserAgents.some(pattern => pattern.test(userAgent));
      if (!isAllowed) return false;
    }

    return true;
  }

  validateIP(req: Request): boolean {
    if (!this.config.allowedIPs || this.config.allowedIPs.length === 0) {
      return true;
    }

    const clientIP = this.getClientIP(req);
    return this.config.allowedIPs.includes(clientIP);
  }

  getRotatingKey(streamId: string, sessionId: string): Buffer | null {
    const keyId = `${streamId}-${sessionId}`;
    const existing = this.activeKeys.get(keyId);

    if (existing && existing.expires > Date.now()) {
      return existing.key;
    }

    const newKey = crypto.randomBytes(16);
    const expires = Date.now() + ENCRYPTION_KEY_TTL;

    this.activeKeys.set(keyId, { key: newKey, expires, sessionId });
    return newKey;
  }

  createSecurityMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.path.includes('/key') && !req.path.includes('/hls/') && !req.path.includes('/auth/')) {
        return next();
      }

      if (req.path.includes('playlist.m3u8') && !req.path.includes('/key')) {
        return next();
      }

      if (req.path.includes('/auth/session')) {
        const rateLimit = this.checkRateLimit(req);
        if (!rateLimit.allowed) {
          res.set('Retry-After', rateLimit.retryAfter?.toString() || '60');
          return res.status(429).json({ 
            error: 'Too many requests', 
            retryAfter: rateLimit.retryAfter 
          });
        }
        return next();
      }

      const rateLimit = this.checkRateLimit(req);
      if (!rateLimit.allowed) {
        res.set('Retry-After', rateLimit.retryAfter?.toString() || '60');
        return res.status(429).json({ 
          error: 'Too many requests', 
          retryAfter: rateLimit.retryAfter 
        });
      }

      if (!this.validateIP(req)) {
        return res.status(403).json({ error: 'Access denied: IP not authorized' });
      }

      const hasAuthToken = req.get('Authorization')?.startsWith('Bearer ');
      const isHLSRequest = req.path.includes('/hls/') || req.path.includes('/key');
      const userAgent = req.get('User-Agent') || '';

      if (isHLSRequest) {
        if (!hasAuthToken) {
          const isBrowserRequest = /Mozilla\/5\.0.*(Chrome|Firefox|Safari|Edge)/i.test(userAgent);
          if (!isBrowserRequest) {
            return res.status(403).json({ error: 'Access denied: HLS requests require browser or auth token' });
          }
        }
      } else {
        if (!this.validateReferrer(req)) {
          return res.status(403).json({ error: 'Access denied: Invalid referrer' });
        }
      }

      if (!this.validateUserAgent(req)) {
        return res.status(403).json({ error: 'Access denied: Invalid client' });
      }

      if (req.path.includes('/key')) {
        const tokenValidation = this.validateSessionToken(req);
        if (!tokenValidation.valid) {
          return res.status(401).json({ 
            error: 'Authentication required', 
            reason: tokenValidation.reason 
          });
        }
        (req as any).sessionId = tokenValidation.sessionId;
      }

      next();
    };
  }

  private generateFingerprint(req: Request): string {
    const components = [
      req.get('User-Agent') || '',
      req.get('Accept-Language') || '',
      req.get('Accept-Encoding') || '',
      this.getClientIP(req)
    ];
    return crypto.createHash('sha256')
      .update(components.join('|'))
      .digest('hex');
  }

  private extractToken(req: Request): string | null {
    const authHeader = req.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return req.query.token as string || null;
  }

  private getClientIP(req: Request): string {
    return req.get('X-Forwarded-For')?.split(',')[0] || 
           req.get('X-Real-IP') || 
           req.connection.remoteAddress || 
           'unknown';
  }

  private getClientIdentifier(req: Request): string {
    return `${this.getClientIP(req)}-${req.get('User-Agent') || 'unknown'}`;
  }

  private startKeyRotation() {
    setInterval(() => {
      const now = Date.now();
      this.activeKeys.forEach((keyData, keyId) => {
        if (keyData.expires <= now) {
          this.activeKeys.delete(keyId);
        }
      });
    }, 60 * 1000);
  }

  cleanupSessions() {
    const now = Date.now();
    const maxAge = 3600 * 1000;

    sessionStore.forEach((session, sessionId) => {
      if (now - session.lastAccess > maxAge) {
        sessionStore.delete(sessionId);
      }
    });
  }
}

export const securityService = new SecurityService({
  maxRequestsPerMinute: 600,
  allowedReferrers: [
    process.env.REPLIT_URL || 'https://localhost:5000',
    'https://replit.app',
    'https://*.replit.app',
    'https://*.replit.com'
  ],
  allowedUserAgents: [
    /Mozilla\/5\.0.*Chrome/i,
    /Mozilla\/5\.0.*Firefox/i,
    /Mozilla\/5\.0.*Safari/i,
    /Mozilla\/5\.0.*Edge/i
  ]
});

setInterval(() => {
  securityService.cleanupSessions();
}, 10 * 60 * 1000);