import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return null;
  }
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const status = err?.status || err?.code;
      const isTransient = status === 429 || status === 503 || status === 500;
      if (!isTransient || attempt === maxAttempts) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
    }
  }
  throw lastErr;
}

const APP_GUIDE_SYSTEM_INSTRUCTION = `You are a friendly, concise in-app AI Help Assistant for a local GiGs, Service Seekers, Business Directory, and Referral Subscription platform.
Give clear, practical, step-by-step help (usually 2 to 5 short sentences or numbered bullets) tailored to what the user is trying to do. Never invent features that don't exist.

Key App Features & Exact Controls:
1. GiGs Map (home map screen):
   - Top search bar: search streets, areas, cities, or provinces to jump anywhere on the map.
   - Right-side Map Menu icon (3 bars on top of the Zoom +/- buttons): opens Create Gig, Add Company Page, and Businesses.
   - Create Gig: tap the map or type a location with live suggestions, add title, pay, category, description, date & time, and publish. Users with an active User Sub or Company Sub can apply to gigs, and creators see views, interests, and applications. Tenants cannot apply to gig posts.
   - Add Company Page: businesses upload Logo & Backcover, set business name, category, open times, contact, email, website, map location, and enable reservations.
   - Businesses (inside the Map Menu icon): opens the Companies & Businesses directory to search pages, jump to a pin, open full page, or start voice-guided navigation.
   - Clicking a Business Page pin on the map: opens its full page to view details, book a reservation, or tap "Navigate to Company" for road routing with female voice guidance.

2. Seekers tab (bottom bar):
   - Browse service providers with face selfies and star ratings.
   - Tap "Hire Out Service" to offer your own service and appear in the Seekers list.
   - Hiring a seeker opens road navigation on the GiGs map plus live in-app chat during navigation.

3. Referrals tab (bottom bar):
   - Copy and share your personal referral link.
   - Referrals are separated into Referral Tenants, User Sub referrals, and Company Sub referrals. Cards turn red when a subscription is close to ending or expired. Only the direct referrer tenant can approve, extend (+30 days), freeze/unfreeze, or reject a referral.

4. Tenant Dashboard (for Tenants & Main Tenant):
   - Shows live monthly profit & active counts for Tenant Sub, User Sub, and Company Sub, plus your 30-day countdown timer.
   - Top-right 3-bar menu opens a full-screen menu with a Top Bar for Subscription Fees, Trial Days, Signup Limits, and Bank Details.
   - Referral Tenants can configure fees & trial days for tenants, users, and companies (capped at 10 companies by default). Main Tenant can set total signup limits for themselves and each Referral Tenant, and view/reply to user feedback via the Feedback Inbox icon.

5. Profile & Settings:
   - Capture or retake your face selfie (shown on the map, Seekers, and Gig posts), update your location, toggle notification sounds, read Help/About, or send Feedback to the Main Tenant.
   - Note: Users who have not chosen/activated a subscription only see GiGs and Logout on the bottom bar until approved or on a free trial.`;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.post('/api/ai-chat', async (req: Request, res: Response) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'AI assistant is not configured yet. Please ensure GEMINI_API_KEY is set in Settings > Secrets.',
      });
      return;
    }

    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!message) {
      res.status(400).json({ error: 'Please enter a message.' });
      return;
    }
    if (message.length > 2000) {
      res.status(400).json({ error: 'Message is too long (max 2000 characters).' });
      return;
    }

    const rawHistory = Array.isArray(req.body?.history) ? req.body.history : [];
    const safeHistory = rawHistory
      .slice(-10)
      .filter(
        (item: any) =>
          item &&
          (item.role === 'user' || item.role === 'model') &&
          typeof item.text === 'string' &&
          item.text.trim().length > 0
      )
      .map((item: any) => ({
        role: item.role as 'user' | 'model',
        parts: [{ text: item.text.trim().slice(0, 1500) }],
      }));

    const ctx = req.body?.context && typeof req.body.context === 'object' ? req.body.context : {};
    const contextSummary = [
      ctx.isAuthenticated ? 'User is signed in.' : 'User is currently not signed in.',
      ctx.isMainTenant ? 'Role: Main Tenant.' : ctx.tier ? `Subscription tier: ${ctx.tier}.` : 'No active tier selected yet.',
      ctx.activeTab ? `Current screen/tab: ${ctx.activeTab}.` : '',
      typeof ctx.gigsCount === 'number' ? `Active gigs on map: ${ctx.gigsCount}.` : '',
      typeof ctx.companiesCount === 'number' ? `Business pages on map: ${ctx.companiesCount}.` : '',
    ]
      .filter(Boolean)
      .join(' ');

    try {
      const replyText = await withRetry(async () => {
        const chat = ai.chats.create({
          model: 'gemini-4-hydrogen',
          history: safeHistory,
          config: {
            systemInstruction: `${APP_GUIDE_SYSTEM_INSTRUCTION}\n\nCurrent User Context: ${contextSummary}`,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        });
        const response = await chat.sendMessage({ message });
        return (response.text || '').trim();
      });

      if (!replyText) {
        res.status(502).json({ error: 'The assistant returned an empty response. Please try again.' });
        return;
      }

      res.json({ reply: replyText });
    } catch (err: any) {
      const statusCode = Number(err?.status) || 500;
      const errMsg =
        err?.message || 'Unable to reach AI assistant right now. Please try again in a moment.';
      res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
        error: errMsg,
      });
    }
  });

  app.post('/api/tts-company-nav', async (req: Request, res: Response) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'GEMINI_API_KEY is not configured for server-side voice synthesis.',
      });
      return;
    }

    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text) {
      res.status(400).json({ error: 'Text prompt is required.' });
      return;
    }

    const clippedText = text.slice(0, 350);

    try {
      const base64Audio = await withRetry(async () => {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: clippedText,
                  speechMetadata: {
                    style: 'Warm, clear, friendly female GPS navigation assistant',
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
            },
          },
        });

        return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || '';
      });

      if (!base64Audio) {
        res.status(502).json({ error: 'Voice audio could not be generated.' });
        return;
      }

      res.json({
        audioBase64: base64Audio,
        mimeType: 'audio/wav',
      });
    } catch (err: any) {
      const statusCode = Number(err?.status) || 500;
      res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
        error: err?.message || 'Voice synthesis failed.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (req: Request, res: Response, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
