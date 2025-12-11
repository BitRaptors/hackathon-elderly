# Deploying to Vercel

This project is configured to deploy to Vercel as a serverless function.

## Prerequisites

1. Install Vercel CLI (if deploying from command line):
   ```bash
   npm i -g vercel
   ```

2. Build the project:
   ```bash
   npm run build
   ```

## Deployment Steps

### Option 1: Deploy via Vercel CLI

1. Login to Vercel:
   ```bash
   vercel login
   ```

2. Deploy:
   ```bash
   vercel
   ```

3. For production deployment:
   ```bash
   vercel --prod
   ```

### Option 2: Deploy via Vercel Dashboard

1. Push your code to GitHub/GitLab/Bitbucket
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Vercel will automatically detect the configuration and deploy

## Environment Variables

Make sure to set these environment variables in your Vercel project settings:

- `ELEVEN_LABS_KEY` or `ELEVENLABS_API_KEY` - Your ElevenLabs API key
- `N8N_WEBHOOK_URL` - (Optional) Your n8n webhook URL for camera scans
- `NODE_ENV` - Set to `production` (automatically set by Vercel)

## Project Structure

- `api/index.ts` - Vercel serverless function entry point
- `vercel.json` - Vercel configuration
- `dist/public/` - Built static files (created after `npm run build`)
- `dist/index.cjs` - Built server bundle (for local production)

## Notes

- The app runs as a serverless function on Vercel
- Static files are served through the Express app
- All routes (including frontend routes) are handled by the serverless function
- The build process creates both the client and server bundles

