"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      theme="dark"
      toastOptions={{
        classNames: {
          toast: "border border-white/10 !bg-[#0e0e0e] !text-[#f4efe7]",
          description: "!text-[#b4b4b4]"
        }
      }}
    />
  );
}
