# ElevenLabs Text-to-Speech Demo

A simple Next.js demo application that converts text to speech using ElevenLabs API.

## Setup

1. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

2. Make sure your `.env` file contains your ElevenLabs API key:
```
ELEVENLABS_API_KEY=your_api_key_here
```

3. Run the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Type some text in the input field
2. Click the "Speak" button (or press Enter)
3. The text will be converted to speech and played

## Project Structure

- `src/app/page.tsx` - Main page component with text input and button
- `src/app/api/text-to-speech/route.ts` - API route that handles TTS requests
- `src/components/ui/` - Reusable UI components (Button, Input)
