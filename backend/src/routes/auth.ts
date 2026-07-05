import { Router, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User';
import { signAppToken, requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();

// The Google OAuth Client ID. Overridable per-environment via GOOGLE_CLIENT_ID.
// Default is the project's dev client so local dev works out of the box.
const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  '103998945467-3e3ghetqb4m5b4d6pvauhmsva7ltr902.apps.googleusercontent.com';

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

/**
 * POST /api/auth/google
 * Body: { credential: <Google ID token> }
 * Verifies the Google ID token, upserts the user, returns an app session token.
 */
router.post('/google', async (req: Request, res: Response) => {
  try {
    const { credential } = req.body;
    if (!credential || typeof credential !== 'string') {
      return res.status(400).json({ error: 'Missing Google credential' });
    }

    // Verify the ID token with Google
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID
      });
      payload = ticket.getPayload();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid Google credential' });
    }

    if (!payload || !payload.sub || !payload.email) {
      return res.status(401).json({ error: 'Google credential missing required fields' });
    }

    // Upsert the user
    const user = await User.findOneAndUpdate(
      { googleId: payload.sub },
      {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name || payload.email,
        picture: payload.picture
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Mint an app session token
    const token = signAppToken({ userId: String(user._id), email: user.email });

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture
      }
    });
  } catch (error) {
    console.error('Error during Google auth:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/auth/me
 * Returns the current authenticated user's profile.
 */
router.get('/me', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId).select('_id email name picture');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture
      }
    });
  } catch (error) {
    console.error('Error fetching current user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
