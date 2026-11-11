import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import apiRoutes from './server/routes.js';
import { initDb, isDbAvailable, getSql } from './server/db.js';
import { searchLeads } from './server/leadAggregator.js';
import { startFreeLeadScraper, getFreeScraperStatus } from './server/freeScraper.js';
import {
  startLeadEngine,
  getEngineStatus,
  enqueueDiscovery,
} from './server/leadEngine/index.js';
import { isGooglePlacesConfigured } from './server/leadSources/googlePlaces.js';
import scraperRoutes from './server/scraper/routes.js';
import { startScraperScheduler } from './server/scraper/cron.js';
import { ensureScraperSchema } from './server/scraper/db.js';
import { isFoursquareConfigured } from './server/leadSources/foursquare.js';
import { isHunterConfigured, getHunterQuota } from './server/leadSources/hunter.js';
import {
  addSuppression,
  removeSuppression,
  findSuppressions,
  setConsent,
  getConsent,
  checkContact,
  attemptOutreach,
  getComplianceStats,
  getComplianceState,
  CHANNELS,
} from './server/compliance/index.js';
import { seedInitialLeads } from './server/data/seedLeads.js';

// â”€â”€ Rate limiting â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 100 requests per 15 min per IP for general API routes;
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  // The admin dashboard polls several endpoints for realtime updates, so it
  // gets its own (authenticated) budget below instead of exhausting this one.
  skip: (req) => req.path.startsWith('/api/admin'),
  message: { error: 'Too many requests, please try again later.' },
});

// Admin dashboard polls periodically; allow a much higher ceiling per IP.
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many admin requests, please slow down.' },
});

// Stricter limit for lead search (resource-intensive);
const leadSearchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Lead search limited to 10 per minute, please wait.' },
});

// â”€â”€ Helmet security headers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const securityHeaders = helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
    // Clerk loads clerk-js from the instance's frontend API host (and jsDelivr
    // as a fallback), so those origins must be allowed when serving the SPA.
    // Google OAuth (via Clerk) needs accounts.google.com for the redirect flow.
    scriptSrc: [
      "'self'",
      'data:',
      'https://*.clerk.accounts.dev',
      'https://clerk.accounts.dev',
      'https://*.clerk.com',
      'https://clerk.com',
      'https://cdn.jsdelivr.net',
      'https://accounts.google.com',
      'https://apis.google.com',
    ],
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: [
      "'self'",
      'https:',
      'https://*.clerk.accounts.dev',
      'https://clerk.accounts.dev',
      'https://*.clerk.com',
      'https://clerk.com',
      'https://accounts.google.com',
      'https://oauth2.googleapis.com',
      'https://www.googleapis.com',
    ],
    frameSrc: [
      "'self'",
      'https://*.clerk.accounts.dev',
      'https://*.clerk.com',
      'https://accounts.google.com',
    ],
    formAction: ["'self'", 'https://accounts.google.com', 'https://*.clerk.accounts.dev', 'https://*.clerk.com'],
    workerSrc: ["'self'", 'blob:'],
    frameAncestors: ["'self'"],
    baseUri: ["'self'"],
  },
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// ---------------------------------------------------------------------------
// Dodo Payments (merchant of record â€” hosted checkout for global + India rails)
// ---------------------------------------------------------------------------
const DODO_API_KEY = process.env.DODO_PAYMENTS_API_KEY || '';
const DODO_MODE = process.env.DODO_PAYMENTS_MODE === 'test' ? 'test' : 'live';
const DODO_BASE_URL =
  DODO_MODE === 'test' ? 'https://test.dodopayments.com' : 'https://live.dodopayments.com';
const DODO_WEBHOOK_SECRET = process.env.DODO_WEBHOOK_SECRET || '';
const DODO_PRODUCTS = {
  Starter: process.env.DODO_PRODUCT_ID_STARTER || '',
  Pro: process.env.DODO_PRODUCT_ID_PRO || '',
  Agency: process.env.DODO_PRODUCT_ID_AGENCY || '',
};
const hasDodo = Boolean(DODO_API_KEY);
const PLAN_CREDITS = { Starter: 100, Pro: 350, Agency: 1000 };

const dodoHeaders = () => ({
  Authorization: `Bearer ${DODO_API_KEY}`,
  'Content-Type': 'application/json',
});

// Idempotent credit grant used by both the return-url verifier and the webhook.
async function grantDodoPlan(userId, planTier, paymentRef) {
  const creditsGranted = PLAN_CREDITS[planTier];
  if (!isDbAvailable() || !userId || !creditsGranted || !paymentRef) return false;

  const sql = getSql();
  const marker = `[dodo:${paymentRef}]`;
  try {
    await sql.begin(async (tx) => {
      const existing = await tx`
        SELECT 1 FROM credit_transactions
        WHERE user_id = ${userId} AND description LIKE ${'%' + marker + '%'}
        LIMIT 1
      `;
      if (existing.length > 0) return;

      const rows = await tx`
        SELECT credits_remaining FROM users WHERE id = ${userId} FOR UPDATE
      `;
      if (rows.length === 0) return;
      const newBalance = (rows[0].credits_remaining ?? 0) + creditsGranted;

      await tx`
        UPDATE users SET
          plan = ${planTier},
          credits_remaining = ${newBalance},
          plan_credits_total = ${creditsGranted},
          updated_at = now()
        WHERE id = ${userId}
      `;
      await tx`
        INSERT INTO credit_transactions (id, user_id, amount, type, description, balance_after)
        VALUES (
          ${'tx_' + crypto.randomBytes(8).toString('hex')},
          ${userId}, ${creditsGranted}, 'subscription',
          ${'Subscription activated: ' + planTier + ' Plan (+' + creditsGranted + ' leads) ' + marker},
          ${newBalance}
        )
      `;
    });
    return true;
  } catch (err) {
    console.error('[dodo] grant failed:', err?.message || err);
    return false;
  }
}

// Svix-style signature verification used by Dodo Payments outgoing webhooks.
function verifyDodoWebhook(rawBody, headers) {
  if (!DODO_WEBHOOK_SECRET) return true; // verification disabled
  const webhookId = headers['webhook-id'];
  const timestamp = headers['webhook-timestamp'];
  const signatureHeader = headers['webhook-signature'];
  if (!webhookId || !timestamp || !signatureHeader) return false;

  const secret = DODO_WEBHOOK_SECRET.replace(/^whsec_/, '');
  const signedContent = `${webhookId}.${timestamp}.${rawBody}`;
  const digest = crypto.createHmac('sha256', secret).update(signedContent, 'utf8').digest('base64');

  return String(signatureHeader)
    .split(' ')
    .some((sig) => {
      const [ , value ] = sig.split(',');
      if (!value) return false;
      const buf = Buffer.from(value);
      return buf.length === Buffer.from(digest).length && crypto.timingSafeEqual(buf, Buffer.from(digest));
    });
}

app.use(
  express.json({
    // Keep the raw body so Dodo webhook svix signatures can be verified.
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    },
  })
);

// CORS for local dev (vite dev server on another port)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Security headers (Helmet + CSP)
app.use(securityHeaders);

// Rate limiting — general API routes (100 requests per 15 min per IP)
app.use(generalLimiter);
// Dedicated (relaxed) budget for realtime admin polling.
app.use('/api/admin', adminLimiter);

// Body size limit â€” 10MB max (prevents abuse / OOM)
app.use(express.json({ limit: '10mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));

// Account / subscription / leads data API (Neon Postgres)
app.use('/api', apiRoutes);

// AI lead scraper (LangGraph workflow) â€” /api/scraper/*
app.use('/api/scraper', scraperRoutes);

// JSON fallback for any API error (async rejections, unexpected throws) so the
// Vite proxy never has to answer with an HTML 502 page.
app.use('/api', (err, _req, res, _next) => {
  console.error('[api] error:', err?.message || err);
  res.status(500).json({ error: 'Server error. Please try again.' });
});

// Live lead discovery: aggregates real listings from every configured platform
// (Google Places when a key is set, OpenStreetMap always). Public endpoint â€”
// browsing leads needs no auth or DB; unlocking still spends credits.
// Hard 45s ceiling so a slow Overpass mirror can never hang the request.
// Rate-limited: 10 searches per minute per IP.
const LEAD_SEARCH_TIMEOUT_MS = 45000;
app.post('/api/leads/search', leadSearchLimiter, async (req, res) => {
  const { industry, city, keyword } = req.body || {};
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve('timeout'), LEAD_SEARCH_TIMEOUT_MS);
  });
  try {
    const result = await Promise.race([
      searchLeads({
        industry: typeof industry === 'string' ? industry : undefined,
        city: typeof city === 'string' ? city : undefined,
        keyword: typeof keyword === 'string' ? keyword : undefined,
      }),
      timeout,
    ]);
    if (result === 'timeout') {
      return res.status(504).json({
        error: 'Live lead sources timed out. Try a specific city or try again shortly.',
      });
    }
    res.json(result);
  } catch (err) {
    console.error('[leads] search failed:', err);
    res.status(500).json({ error: 'Lead fetch failed' });
    } finally {
      clearTimeout(timer);
    }
  });

// Free scraper status: shows the last run, next run, and whether the
// 100+ daily lead floor has been met today.
app.get('/api/leads/scraper-status', (_req, res) => {
  res.json(getFreeScraperStatus());
});

// Lead engine status (multi-source discovery cycle every 5â€“10 min).
app.get('/api/leads/engine-status', (_req, res) => {
  res.json(getEngineStatus());
});

// Manually trigger one discovery cycle (rate-limited with the search limiter).
app.post('/api/leads/engine-run', leadSearchLimiter, async (_req, res) => {
  try {
    const result = await enqueueDiscovery();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Engine run failed' });
  }
});

// â”€â”€ Consent, Opt-Out & Outreach Compliance Controls â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Best-effort session guard: enforces a login when Postgres is configured and
// degrades to open access in local/no-DB mode (consistent with engine routes).
async function requireAuthIfAvailable(req, res, next) {
  try {
    if (!isDbAvailable()) return next();
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Sign in to manage compliance controls' });
    const sql = getSql();
    const rows = await sql`
      SELECT u.id FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = ${token} AND s.expires_at > now()
    `;
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid or expired session' });
    next();
  } catch (err) {
    next(err);
  }
}

const publicSuppression = (entry) => ({
  id: entry.id,
  kind: entry.kind,
  value: entry.value,
  channels: entry.channels,
  reason: entry.reason,
  source: entry.source,
  createdAt: entry.createdAt,
});

// PUBLIC â€” unsubscribe links must work without a session or the DB.
app.post('/api/compliance/opt-out', async (req, res) => {
  try {
    const { phone, email, leadId, domain, channels, reason } = req.body || {};
    if (!phone && !email && !leadId && !domain) {
      return res.status(400).json({ error: 'Provide phone, email, leadId or domain' });
    }
    const result = addSuppression({
      phone,
      email,
      leadId,
      domain,
      channels,
      reason: reason || 'opt-out request',
      source: 'self-serve',
    });
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ ok: true, suppressed: true, entries: result.created.map(publicSuppression) });
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Opt-out failed' });
  }
});

// PUBLIC â€” lets a contact verify their opt-out status.
app.get('/api/compliance/opt-out/check', (req, res) => {
  try {
    const { phone, email, leadId, domain } = req.query || {};
    const lead = { id: leadId, phone, email, website: domain };
    const suppressions = findSuppressions(lead);
    res.json({
      suppressed: suppressions.length > 0,
      entries: suppressions.map(publicSuppression),
      consent: getConsent(lead)?.status || 'unknown',
    });
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Status check failed' });
  }
});

// Dashboard stats + effective policy + lead-source availability.
app.get('/api/compliance/stats', requireAuthIfAvailable, (_req, res) => {
  res.json({
    ...getComplianceStats(),
    sources: {
      openStreetMap: true,
      googlePlaces: isGooglePlacesConfigured(),
      foursquare: isFoursquareConfigured(),
      hunter: isHunterConfigured(),
      hunterQuota: getHunterQuota(),
    },
    channels: CHANNELS,
  });
});

// Suppression list (opt-outs / DNC) management.
app.get('/api/compliance/suppression', requireAuthIfAvailable, (_req, res) => {
  const { suppression } = getComplianceState();
  res.json({ entries: suppression.map(publicSuppression) });
});

app.post('/api/compliance/suppression', requireAuthIfAvailable, (req, res) => {
  try {
    const { phone, email, leadId, domain, channels, reason, notes } = req.body || {};
    const result = addSuppression({
      phone,
      email,
      leadId,
      domain,
      channels,
      reason: reason || 'manual suppression',
      source: 'manual',
      notes,
    });
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ ok: true, entries: result.created.map(publicSuppression) });
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Suppression failed' });
  }
});

app.delete('/api/compliance/suppression/:id', requireAuthIfAvailable, (req, res) => {
  try {
    const removed = removeSuppression(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Entry not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Removal failed' });
  }
});

// Consent ledger â€” read / write per-channel decisions.
app.get('/api/compliance/consent', requireAuthIfAvailable, (req, res) => {
  try {
    const { leadId, phone, email, domain } = req.query || {};
    const record = getConsent({ id: leadId, phone, email, website: domain });
    res.json({ consent: record || null, status: record?.status || 'unknown' });
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Consent lookup failed' });
  }
});

app.post('/api/compliance/consent', requireAuthIfAvailable, (req, res) => {
  try {
    const { leadId, phone, email, domain, status, channels, lawfulBasis, note } = req.body || {};
    const result = setConsent({
      leadId,
      phone,
      email,
      domain,
      status,
      channels,
      lawfulBasis,
      note,
      source: 'manual',
    });
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ ok: true, updated: result.updated, consent: result.record });
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Consent update failed' });
  }
});

// Dry-run a contact decision (used by the UI "Can I contact?" tester).
app.post('/api/compliance/check', requireAuthIfAvailable, (req, res) => {
  try {
    const { lead, channel } = req.body || {};
    if (!lead || typeof lead !== 'object') return res.status(400).json({ error: 'lead is required' });
    const ch = CHANNELS.includes(channel) ? channel : 'email';
    res.json(checkContact({ lead, channel: ch }));
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Check failed' });
  }
});

// Record an outreach attempt (also logs blocked attempts for auditing).
app.post('/api/compliance/outreach', requireAuthIfAvailable, (req, res) => {
  try {
    const { lead, channel, outcome } = req.body || {};
    if (!lead || typeof lead !== 'object') return res.status(400).json({ error: 'lead is required' });
    const ch = CHANNELS.includes(channel) ? channel : 'email';
    res.json(attemptOutreach({ lead, channel: ch, outcome: outcome || 'sent' }));
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Outreach log failed' });
  }
});

// Public payment config so the frontend knows whether live mode is available
app.get('/api/payment/config', (_req, res) => {
  res.json({
    currency: 'INR',
    dodo: {
      live: hasDodo,
      mode: DODO_MODE,
      products: hasDodo ? Object.fromEntries(Object.entries(DODO_PRODUCTS).filter(([, v]) => v)) : {},
    },
  });
});

// Create a Dodo Payments hosted checkout session and return the redirect URL.
app.post('/api/payment/dodo/create-checkout', async (req, res) => {
  if (!hasDodo) {
    return res.status(503).json({ error: 'Dodo Payments not configured on server' });
  }

  try {
    const { planId, userId, email, name, returnUrl, cancelUrl } = req.body || {};
    const normPlan = String(planId || '').trim();
    const matchedKey = Object.keys(DODO_PRODUCTS).find(
      (k) => k.toLowerCase() === normPlan.toLowerCase()
    );
    const resolvedPlanId = matchedKey || normPlan;
    const productId = req.body.productId || (matchedKey ? DODO_PRODUCTS[matchedKey] : '');
    if (!productId) {
      return res.status(400).json({
        error: `Missing Dodo product ID for plan "${planId}". Set DODO_PRODUCT_ID_${normPlan.toUpperCase()} in your .env file or Dodo dashboard.`,
      });
    }
    if (!email) {
      return res.status(400).json({ error: 'Customer email is required' });
    }

    const origin =
      (typeof returnUrl === 'string' && returnUrl.startsWith('http') ? new URL(returnUrl).origin : null) ||
      req.headers.origin ||
      `http://localhost:${PORT}`;

    const body = {
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: { email, name: name || undefined },
      return_url:
        returnUrl ||
        `${origin}/?provider=dodo&payment=success&plan=${encodeURIComponent(planId)}`,
      cancel_url: cancelUrl || `${origin}/?provider=dodo&payment=cancelled`,
      metadata: {
        planId: String(planId),
        userId: String(userId || ''),
      },
      // India rails first, cards always present as fallback (Dodo requirement).
      allowed_payment_method_types: ['upi_intent', 'upi_collect', 'credit', 'debit'],
    };

    const response = await fetch(`${DODO_BASE_URL}/checkouts`, {
      method: 'POST',
      headers: dodoHeaders(),
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.message || data?.error || data?.detail || 'Checkout session creation failed';
      return res.status(response.status).json({ error: message });
    }

    res.json({
      sessionId: data.session_id,
      checkoutUrl: data.checkout_url,
      mode: DODO_MODE,
    });
  } catch (err) {
    console.error('[dodo] create-checkout failed:', err?.message || err);
    res.status(500).json({ error: 'Unable to reach Dodo Payments API' });
  }
});

// Poll a checkout session after the customer returns from Dodo hosted checkout.
// If the payment already succeeded, grant credits server-side (idempotent).
app.get('/api/payment/dodo/session/:id', async (req, res) => {
  if (!hasDodo) {
    return res.status(503).json({ error: 'Dodo Payments not configured on server' });
  }

  try {
    const response = await fetch(`${DODO_BASE_URL}/checkouts/${encodeURIComponent(req.params.id)}`, {
      headers: dodoHeaders(),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.message || data?.error || 'Session lookup failed' });
    }

    const paymentStatus = data.payment_status || data.status || 'pending';
    const paid = paymentStatus === 'succeeded' || paymentStatus === 'paid' || Boolean(data.payment_id);

    // Best-effort server-side grant when the session is paid (webhook is authoritative).
    const meta = data.metadata || {};
    const planId = meta.planId || req.query.plan;
    const userId = meta.userId || req.query.userId;
    const paymentRef = data.payment_id || data.session_id;
    let granted = false;
    if (paid && planId && userId) {
      granted = await grantDodoPlan(userId, String(planId), String(paymentRef));
    }

    res.json({
      sessionId: data.session_id || req.params.id,
      paymentStatus,
      paid,
      paymentId: data.payment_id || null,
      planId: planId || null,
      userId: userId || null,
      granted,
    });
  } catch (err) {
    console.error('[dodo] session lookup failed:', err?.message || err);
    res.status(500).json({ error: 'Unable to reach Dodo Payments API' });
  }
});

// Dodo Payments webhook (payment.succeeded etc). Register this URL in the
// Dodo dashboard: {APP_URL}/api/payment/dodo/webhook
// Uses the raw body captured by express.json's verify hook for signature checks.
app.post('/api/payment/dodo/webhook', async (req, res) => {
    if (!hasDodo) return res.status(503).json({ error: 'Dodo Payments not configured' });

    const rawBody = req.rawBody || (Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body || {}));
    if (!verifyDodoWebhook(rawBody, req.headers)) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    let event;
    try {
      event = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }

    const type = event?.event_type || event?.type || '';
    const payload = event?.payload || event?.data || {};
    const payment = payload.payment || payload;
    const status = payment.payment_status || payment.status || '';

    // Grant credits on successful one-time payments (and initial subscription charges).
    const isSuccess =
      type === 'payment.succeeded' ||
      type === 'subscription.active' ||
      type === 'subscription.payment.succeeded' ||
      (!type && status === 'succeeded');

    if (isSuccess) {
      const meta = payment.metadata || payload.metadata || {};
      const planId = meta.planId;
      const userId = meta.userId;
      const paymentRef = payment.payment_id || payment.id || event?.event_id || event?.id;
      if (planId && userId && paymentRef) {
        await grantDodoPlan(String(userId), String(planId), String(paymentRef));
      }
    }

    res.json({ received: true });
  }
);

// Serve built frontend in production if dist exists
const distDir = path.join(__dirname, 'dist');
app.use(express.static(distDir));
app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'), (err) => {
    if (err) res.status(404).send('Frontend not built. Run npm run build.');
  });
});

// Keep the process alive on stray async errors (e.g. a dropped Neon
// connection mid-query) â€” otherwise Node exits and every proxy request 502s.
process.on('unhandledRejection', (err) => {
  console.error('[process] unhandledRejection:', err?.message || err);
});
process.on('uncaughtException', (err) => {
  console.error('[process] uncaughtException:', err?.message || err);
});

app.listen(PORT, async () => {
  console.log(`LeadifySphere server running on http://localhost:${PORT}`);
  await initDb();
  console.log(
    isDbAvailable()
      ? '[db] Neon Postgres: ENABLED (accounts, subscriptions, credits, lists are persisted).'
      : '[db] Neon Postgres: OFF â€” set DATABASE_URL in .env to persist data. Falling back to localStorage.'
  );
  console.log(
    isGooglePlacesConfigured()
      ? '[leads] Live platforms: Google Places + OpenStreetMap + Wikidata'
      : '[leads] Live platforms: OpenStreetMap + Wikidata (set GOOGLE_PLACES_API_KEY in .env to also pull Google Maps listings)'
  );

  // Pre-warm the lead cache in the background so the first search in the UI
  // is served from cache instead of waiting on Overpass/Places.
  setTimeout(() => {
    searchLeads({})
      .then((r) => console.log(`[leads] cache pre-warmed: ${r.leads.length} leads from ${r.sources.map((s) => s.name).join(' + ') || 'no sources'}`))
      .catch((err) => console.warn(`[leads] cache pre-warm failed: ${err.message}`));
  }, 1500);

  // Pre-seed master store with 1,000+ unique verified leads if needed
  try {
    seedInitialLeads();
  } catch (err) {
    console.warn('[seed] Initial seeding error:', err?.message || err);
  }

  // Free background scraper: re-pulls open sources every 1â€“5 minutes and
  // keeps a hard floor of 1000+ unique leads in the daily pool.
  startFreeLeadScraper();

  // Multi-source lead engine (BullMQ when REDIS_URL is set, else timer):
  // discovers, dedupes and scores fresh leads into Postgres every 5â€“10 min.
  startLeadEngine().catch((err) => console.warn('[leadEngine] start failed:', err?.message || err));

  // AI lead scraper: LangGraph workflow scheduled daily at 08:00 (Asia/Kolkata).
  try {
    await ensureScraperSchema();
    const schedule = startScraperScheduler();
    console.log(
      `[scraper] Daily lead scraper armed: ${schedule.expression} (${schedule.timezone}), next run ${schedule.nextRun || 'n/a'}`
    );
  } catch (err) {
    console.warn('[scraper] scheduler start failed:', err?.message || err);
  }

  console.log(
    hasDodo
      ? `Dodo Payments ${DODO_MODE.toUpperCase()} mode enabled (products: ${Object.entries(DODO_PRODUCTS).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none'})`
      : 'Dodo Payments OFF â€” set DODO_PAYMENTS_API_KEY and DODO_PRODUCT_ID_* in .env to enable Dodo hosted checkout'
  );
});
