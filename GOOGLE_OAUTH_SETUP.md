# Google OAuth Setup Guide

This app now supports Google Sign-In/Sign-Up. Users can authenticate using their Google account in addition to email/password.

## Prerequisites

You need a Google Cloud project with OAuth 2.0 credentials. Follow these steps:

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click on the project dropdown at the top
3. Click "NEW PROJECT"
4. Name it (e.g., "DocFlow")
5. Click "CREATE"

### Step 2: Enable Google+ API

1. In the Google Cloud Console, go to "APIs & Services" → "Enabled APIs & services"
2. Click "+ ENABLE APIS AND SERVICES"
3. Search for "Google+ API"
4. Click on it and click "ENABLE"

### Step 3: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "+ CREATE CREDENTIALS"
3. Choose "OAuth client ID"
4. If prompted, set up the OAuth consent screen first:
   - User Type: External
   - Fill in basic info (app name, support email, etc.)
   - Save and Continue
5. Back on Credentials page, click "+ CREATE CREDENTIALS" → "OAuth client ID"
6. Application type: **Web application**
7. Name: "DocFlow Web"
8. Add Authorized redirect URIs:
   - `http://localhost:5173` (development)
   - `http://localhost:3001` (development)
   - `http://127.0.0.1:5173`
   - Your production domain (when ready)
9. Click "CREATE"
10. Copy the **Client ID** from the popup

### Step 4: Configure Environment Variables

#### Client Side (Frontend)

1. Open `client/.env.local`
2. Replace `YOUR_GOOGLE_CLIENT_ID_HERE` with your actual Client ID:
   ```
   VITE_GOOGLE_CLIENT_ID=YOUR_ACTUAL_CLIENT_ID_FROM_GOOGLE
   ```

#### Server Side (Backend)

1. Open `.env` in the project root
2. Uncomment and set the GOOGLE_CLIENT_ID:
   ```
   GOOGLE_CLIENT_ID=YOUR_ACTUAL_CLIENT_ID_FROM_GOOGLE
   ```

### Step 5: Restart the Dev Server

```bash
npm run dev
```

## How It Works

### Frontend
- Users click "Sign in with Google" button on login/signup page
- Google's OAuth flow opens a popup
- User authenticates with their Google account
- Frontend sends the ID token to the backend

### Backend
- `/api/auth/google` endpoint receives the ID token
- Token is verified using Google's libraries
- User is found or created by email
- JWT token is generated for the session
- User is logged in

## Testing

1. Start the dev server: `npm run dev`
2. Go to http://localhost:5179 (or whatever port Vite uses)
3. Click "Sign up" or "Login"
4. Click the "Sign in with Google" button
5. Sign in with your Google account
6. You should be redirected to the chat page

## Troubleshooting

### "Google OAuth not configured" error
- Make sure `GOOGLE_CLIENT_ID` is set in `.env`
- Make sure you've restarted the server after changing `.env`

### Google popup doesn't work
- Check that the redirect URI in Google Console matches your localhost
- Check browser console for CORS errors
- Make sure `VITE_GOOGLE_CLIENT_ID` is set in `client/.env.local`

### Invalid token error
- The Client ID might be wrong
- Make sure both frontend and backend are using the same Client ID
- Make sure you're using the **Client ID** not the Client Secret

## Production Deployment

When deploying to production:

1. Update authorized redirect URIs in Google Console to your production domain
2. Set environment variables on your production server:
   - Frontend: `VITE_GOOGLE_CLIENT_ID=...` (build-time variable)
   - Backend: `GOOGLE_CLIENT_ID=...` (runtime variable)
3. Rebuild and redeploy

## Security Notes

- Google Client ID is public (okay to expose in frontend)
- Google Client Secret should NEVER be exposed (not used in this setup)
- ID tokens are verified server-side before accepting login
- JWT tokens have 30-day expiration (configurable in auth.js)
