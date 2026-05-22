import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function CheckoutCancelPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-24">
      <div className="section-kicker">Checkout canceled</div>
      <h1 className="mt-6 text-6xl font-semibold uppercase text-[#f4efe7]">
        No charge was made
      </h1>
      <p className="mt-4 text-2xl text-foreground/60">
        Your cart is still waiting for you if you want to jump back in.
      </p>
      <div className="mt-8">
        <Button asChild>
          <Link href="/#beats">Return to beats</Link>
        </Button>
      </div>
    </main>
  );
}
