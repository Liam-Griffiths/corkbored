// Boot-critical environment variables, validated once at module load.
// A missing one fails fast with a clear message instead of surfacing as a
// cryptic runtime error deep inside a request (e.g. Auth.js MissingSecret).
//
// Feature-gated vars (Stripe, Resend, Anthropic, cron, chat, etc.) are NOT
// checked here — they're validated at their point of use so the app still
// boots with those features turned off.

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in your environment (Vercel → Settings → Environment Variables) and redeploy.`,
    );
  }
  return value;
}

export const env = {
  AUTH_SECRET: required("AUTH_SECRET"),
  AUTH_GITHUB_ID: required("AUTH_GITHUB_ID"),
  AUTH_GITHUB_SECRET: required("AUTH_GITHUB_SECRET"),
};
