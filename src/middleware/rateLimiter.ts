import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

interface SubmissionTracker {
  count: number;
  firstSubmission: number;
  lastSubmission: number;
  blockedUntil?: number;
}

// In-memory store for tracking submissions by IP and email
const submissionTracker = new Map<string, SubmissionTracker>();
const emailTracker = new Map<string, SubmissionTracker>();

// Global rate limiter for all API endpoints
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    error: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests from this IP, please try again later.',
      error: 'RATE_LIMIT_EXCEEDED'
    });
  }
});

// Custom rate limiter specifically for vendor submissions
export const vendorSubmissionRateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] as string || 'unknown';
  const email = req.body.email?.toLowerCase();
  const now = Date.now();
  
  // Rate limits configuration
  const IP_WINDOW = 60 * 60 * 1000; // 1 hour
  const IP_MAX_ATTEMPTS = 3; // 3 submissions per hour per IP
  const EMAIL_WINDOW = 24 * 60 * 60 * 1000; // 24 hours
  const EMAIL_MAX_ATTEMPTS = 1; // 1 submission per day per email
  const BLOCK_DURATION = 60 * 60 * 1000; // 1 hour block

  console.log(`Rate limit check for IP: ${ip}, Email: ${email}`);

  try {
    // Check IP-based rate limiting
    const ipTracker = submissionTracker.get(ip);
    if (ipTracker) {
      // Check if still blocked
      if (ipTracker.blockedUntil && now < ipTracker.blockedUntil) {
        const blockTimeLeft = Math.ceil((ipTracker.blockedUntil - now) / (60 * 1000));
        console.log(`IP ${ip} is blocked for ${blockTimeLeft} more minutes`);
        return res.status(429).json({
          success: false,
          message: `Too many submissions from this location. Try again in ${blockTimeLeft} minutes.`,
          error: 'IP_BLOCKED',
          blockTimeLeft
        });
      }

      // Reset if window expired
      if (now - ipTracker.firstSubmission > IP_WINDOW) {
        console.log(`IP window expired for ${ip}, resetting tracker`);
        submissionTracker.delete(ip);
      } else if (ipTracker.count >= IP_MAX_ATTEMPTS) {
        // Block this IP
        ipTracker.blockedUntil = now + BLOCK_DURATION;
        submissionTracker.set(ip, ipTracker);
        console.log(`IP ${ip} blocked due to too many attempts`);
        return res.status(429).json({
          success: false,
          message: 'Too many submissions from this location. Please try again later.',
          error: 'IP_RATE_LIMIT_EXCEEDED',
          blockTimeLeft: Math.ceil(BLOCK_DURATION / (60 * 1000))
        });
      }
    }

    // Check email-based rate limiting
    if (email) {
      const emailTrackerData = emailTracker.get(email);
      if (emailTrackerData) {
        if (now - emailTrackerData.firstSubmission < EMAIL_WINDOW) {
          const hoursLeft = Math.ceil((EMAIL_WINDOW - (now - emailTrackerData.firstSubmission)) / (60 * 60 * 1000));
          console.log(`Email ${email} has recent submission, ${hoursLeft} hours left`);
          return res.status(409).json({
            success: false,
            message: `A submission with this email already exists. Please wait ${hoursLeft} hours before submitting again.`,
            error: 'DUPLICATE_EMAIL',
            hoursLeft
          });
        } else {
          // Reset if window expired
          console.log(`Email window expired for ${email}, resetting tracker`);
          emailTracker.delete(email);
        }
      }
    }

    // Update trackers
    const currentIpTracker = submissionTracker.get(ip) || {
      count: 0,
      firstSubmission: now,
      lastSubmission: now
    };
    
    currentIpTracker.count++;
    currentIpTracker.lastSubmission = now;
    if (currentIpTracker.count === 1) {
      currentIpTracker.firstSubmission = now;
    }
    submissionTracker.set(ip, currentIpTracker);
    console.log(`Updated IP tracker for ${ip}: ${currentIpTracker.count} attempts`);

    if (email) {
      emailTracker.set(email, {
        count: 1,
        firstSubmission: now,
        lastSubmission: now
      });
      console.log(`Set email tracker for ${email}`);
    }

    next();
  } catch (error) {
    console.error('Error in rate limiter:', error);
    // Don't block the request if there's an error in rate limiting
    next();
  }
};

// Cleanup function to remove old entries
export const cleanupTrackers = () => {
  const now = Date.now();
  const IP_WINDOW = 60 * 60 * 1000;
  const EMAIL_WINDOW = 24 * 60 * 60 * 1000;
  let cleanedIps = 0;
  let cleanedEmails = 0;

  // Cleanup IP tracker
  for (const [ip, tracker] of submissionTracker.entries()) {
    if (now - tracker.firstSubmission > IP_WINDOW && (!tracker.blockedUntil || now > tracker.blockedUntil)) {
      submissionTracker.delete(ip);
      cleanedIps++;
    }
  }

  // Cleanup email tracker
  for (const [email, tracker] of emailTracker.entries()) {
    if (now - tracker.firstSubmission > EMAIL_WINDOW) {
      emailTracker.delete(email);
      cleanedEmails++;
    }
  }

  if (cleanedIps > 0 || cleanedEmails > 0) {
    console.log(`Cleanup completed: ${cleanedIps} IPs, ${cleanedEmails} emails removed`);
  }
};

// Get current tracker status (for debugging)
export const getTrackerStatus = () => {
  return {
    ipTrackers: submissionTracker.size,
    emailTrackers: emailTracker.size,
    ipEntries: Array.from(submissionTracker.entries()).map(([ip, data]) => ({
      ip,
      count: data.count,
      blocked: data.blockedUntil ? data.blockedUntil > Date.now() : false
    })),
    emailEntries: Array.from(emailTracker.entries()).map(([email, data]) => ({
      email: email.replace(/(.{3}).*(@.*)/, '$1***$2'), // Partially hide email
      timestamp: new Date(data.firstSubmission).toISOString()
    }))
  };
};

// Run cleanup every 10 minutes
setInterval(cleanupTrackers, 10 * 60 * 1000);

// Export tracker maps if needed for testing
export { submissionTracker, emailTracker }; 