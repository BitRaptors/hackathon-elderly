# Deployment Guide - Vercel

This guide will help you deploy this Next.js application to Vercel.

## Prerequisites

- A GitHub, GitLab, or Bitbucket account
- Your code pushed to a remote repository
- A Vercel account (free tier is sufficient)

## Step-by-Step Deployment

### 1. Push Your Code to GitHub (if not already done)

```bash
# Make sure all changes are committed
git add .
git commit -m "Prepare for deployment"

# Push to your remote repository
git push origin develop
# or
git push origin main
```

### 2. Sign Up / Log In to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Sign Up" or "Log In"
3. Sign in with your GitHub account (recommended for easy integration)

### 3. Import Your Project

1. Click "Add New..." → "Project"
2. Import your Git repository
3. Select the repository containing this project

### 4. Configure Project Settings

**CRITICAL**: Since your Next.js app is in the `Voice-Test` subdirectory, you MUST configure:

- **Root Directory**: Click "Edit" and set to `Voice-Test` (this is essential!)
- **Framework Preset**: Next.js (should be auto-detected after setting root directory)
- **Build Command**: Leave as default (`npm run build`) - Vercel will run this in the Voice-Test directory
- **Output Directory**: Leave BLANK or remove if set to "public" - Next.js doesn't need this, Vercel handles it automatically
- **Install Command**: Leave as default (`npm install`)

**Important**: Do NOT set Output Directory to "public" - that's for static sites, not Next.js apps!

### 5. Add Environment Variables

**IMPORTANT**: Add your ElevenLabs API key in Vercel's dashboard:

1. In the project settings, go to "Environment Variables"
2. Add a new variable:
   - **Name**: `ELEVEN_LABS_KEY`
   - **Value**: Your ElevenLabs API key (the one from your `.env` file)
   - **Environment**: Select all (Production, Preview, Development)

**Note**: The API route supports both `ELEVEN_LABS_KEY` and `ELEVENLABS_API_KEY`, but `ELEVEN_LABS_KEY` is what your `.env` uses.

### 6. Deploy

1. Click "Deploy"
2. Wait for the build to complete (usually 1-2 minutes)
3. Your app will be live at `your-project-name.vercel.app`

### 7. Custom Domain (Optional)

1. Go to Project Settings → Domains
2. Add your custom domain
3. Follow Vercel's DNS configuration instructions

## Environment Variables Reference

Create a `.env.example` file (already in `.gitignore`) with:
```
ELEVEN_LABS_KEY=your_elevenlabs_api_key_here
```

## Troubleshooting

### Error: "No Output Directory named 'public' found"

This error occurs when Vercel is not detecting your project as Next.js. Fix it by:

1. **Go to Project Settings → General**
2. **Set Root Directory to**: `Voice-Test` (click "Edit" next to Root Directory)
3. **Remove or clear the Output Directory field** - Next.js doesn't need this, Vercel handles it automatically
4. **Verify Framework Preset is set to**: `Next.js`
5. **Save and redeploy**

The `vercel.json` file in your project should help, but the Root Directory setting is the most important fix.

### Build Fails
- Check the build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Verify Node.js version compatibility
- Make sure Root Directory is set to `Voice-Test`

### API Key Not Working
- Double-check the environment variable name in Vercel matches `ELEVEN_LABS_KEY`
- Ensure the API key has the correct permissions in ElevenLabs dashboard
- Check Vercel function logs for detailed error messages

### API Routes Not Working
- Verify the API route is in `src/app/api/` directory
- Check Vercel function logs for errors
- Ensure the route exports the correct HTTP method handlers

## Automatic Deployments

Once connected to Git:
- **Production**: Deploys automatically when you push to your main branch
- **Preview**: Creates preview deployments for every push to other branches
- **Pull Requests**: Creates preview deployments for PRs

## Useful Vercel Features

- **Analytics**: Monitor your app's performance
- **Logs**: View serverless function logs in real-time
- **Edge Functions**: Deploy functions closer to users
- **Image Optimization**: Automatic Next.js image optimization

## Need Help?

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- [Vercel Support](https://vercel.com/support)

