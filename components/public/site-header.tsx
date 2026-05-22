"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/lib/cart";

const links = [
  { href: "#about", label: "About" },
  { href: "#beats", label: "Beats" },
  { href: "#kits", label: "Sound Kits" },
  { href: "#plans", label: "Plans" },
  { href: "#services", label: "Services" }
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const cartCount = useCartStore((state) => state.items.length);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled ? "bg-black/72 backdrop-blur-xl" : "bg-transparent"
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-10">
        <Link href="#top" prefetch={false} className="flex items-center gap-3">
          <Image
            src="/media/logo.webp"
            alt="Yunginz logo"
            width={42}
            height={42}
            sizes="42px"
            className="h-10 w-10 rounded-full object-cover"
          />
          <div className="font-mono text-sm uppercase tracking-[0.32em] text-primary sm:text-base">
            YUNG1NZ
          </div>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch={false}
              className="font-mono text-[0.7rem] uppercase tracking-[0.34em] text-foreground/70 hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/checkout"
            prefetch={false}
            className="relative flex h-10 w-10 items-center justify-center border border-primary/40 text-primary transition hover:bg-primary hover:text-black"
            aria-label="Open cart"
          >
            <ShoppingBag className="h-4 w-4" />
            {cartCount ? (
              <span className="absolute -right-2 -top-2 min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-center font-mono text-[10px] text-black">
                {cartCount}
              </span>
            ) : null}
          </Link>
          <Button
            className="h-10 px-6 py-2 text-xs"
            onClick={() =>
              document.getElementById("beats")?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Get A Beat
          </Button>
        </nav>

        <div className="flex items-center gap-3 md:hidden">
          <Link
            href="/checkout"
            prefetch={false}
            className="relative flex h-10 w-10 items-center justify-center border border-primary/40 text-primary"
            aria-label="Open cart"
          >
            <ShoppingBag className="h-4 w-4" />
            {cartCount ? (
              <span className="absolute -right-2 -top-2 min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-center font-mono text-[10px] text-black">
                {cartCount}
              </span>
            ) : null}
          </Link>
          <button onClick={() => setOpen((value) => !value)} aria-label="Toggle navigation">
            <Menu className="h-6 w-6 text-primary" />
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-white/10 bg-black/95 px-6 py-4 md:hidden">
          <div className="flex flex-col gap-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                prefetch={false}
                onClick={() => setOpen(false)}
                className="font-mono text-xs uppercase tracking-[0.35em] text-foreground/80"
              >
                {link.label}
              </Link>
            ))}
            <Button
              className="justify-center text-xs"
              onClick={() => {
                setOpen(false);
                document.getElementById("beats")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Get A Beat
            </Button>
          </div>
        </div>
      ) : null}
    </header>
  );
}
