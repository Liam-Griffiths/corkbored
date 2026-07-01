import type { Metadata } from "next";
import { cookies } from "next/headers";
import { signIn } from "@/lib/auth";
import { Header } from "@/components/Header";
import { SignInForm } from "@/components/SignInForm";
import { CONSENT_COOKIE, TERMS_VERSION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Sign in — Corkbored",
};

// Only allow internal callback paths (prevents open-redirect via ?callbackUrl=).
function safeCallback(raw: string | undefined): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/board";
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const redirectTo = safeCallback(callbackUrl);

  async function startSignIn() {
    "use server";
    // Record consent for this policy version; the cookie is read back after the
    // OAuth round trip and written to the user (see auth.ts session callback).
    (await cookies()).set(CONSENT_COOKIE, TERMS_VERSION, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 15,
    });
    await signIn("github", { redirectTo });
  }

  return (
    <>
      <Header />
      <main className="mx-auto flex max-w-sm flex-col items-center px-5 py-16 text-center">
        <span className="mb-4 inline-block h-3 w-3 rounded-full bg-pin-red shadow-[inset_-2px_-2px_3px_rgba(0,0,0,.35)]" />
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
          Sign in to Corkbored
        </h1>
        <p className="mt-2 font-mono text-sm text-ink-soft">
          We use GitHub to sign you in. New here? An account is created automatically.
        </p>

        <SignInForm action={startSignIn} />
      </main>
    </>
  );
}
