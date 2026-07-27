"use client";

export default function RootError({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="text-6xl font-semibold uppercase text-[#f4efe7]">
        Something went wrong
      </h1>
      <p className="mt-4 text-2xl text-foreground/60">
        An unexpected error occurred. Please try again or contact support.
      </p>
      <button
        onClick={reset}
        className="mt-8 h-12 rounded-full border border-primary/40 bg-transparent px-8 font-mono text-xs uppercase tracking-[0.2em] text-primary transition hover:bg-primary hover:text-black"
      >
        Try again
      </button>
    </main>
  );
}
