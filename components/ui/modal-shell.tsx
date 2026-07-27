"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

export function ModalShell({
  open,
  onClose,
  children,
  className
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const previous = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open && panelRef.current) {
      panelRef.current.scrollTop = 0;
    }
  }, [open, children]);

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={() => onCloseRef.current()}>
      <div
        ref={panelRef}
        className={cn("modal-panel", className)}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          onClick={() => onCloseRef.current()}
          className="absolute right-4 top-4 z-10 shrink-0 rounded-full border border-white/10 p-2 text-primary transition hover:border-primary/50"
          aria-label="Close modal"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}
