import Link from "next/link";
import { Header } from "@/components/Header";

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="flex min-h-[60vh] items-center justify-center px-5">
        <div className="text-center">
          <p className="font-mono text-6xl font-bold text-ink/10 select-none">404</p>
          <h1 className="mt-4 font-display font-bold text-2xl text-ink">Page not found</h1>
          <p className="mt-2 font-mono text-sm text-ink-soft">
            That pin fell off the board.
          </p>
          <Link
            href="/board"
            className="mt-6 inline-block rounded-md bg-pin-red px-5 py-2.5 font-mono text-sm font-medium text-white shadow-[0_2px_0_#7c2d14] hover:-translate-y-px"
          >
            Back to the board
          </Link>
        </div>
      </main>
    </>
  );
}
