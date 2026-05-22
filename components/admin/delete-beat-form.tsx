"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteBeat } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

export function DeleteBeatForm({
  beatId,
  beatTitle,
  hasOrders
}: {
  beatId: string;
  beatTitle: string;
  hasOrders: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  return (
    <form
      className="mt-6 space-y-2"
      onSubmit={(event) => {
        const message = hasOrders
          ? `This beat has purchase history, but the order snapshots will be preserved.\n\nDelete "${beatTitle}" completely?`
          : `Delete "${beatTitle}" and remove its uploaded files?`;

        if (!window.confirm(message)) {
          event.preventDefault();
          return;
        }

        event.preventDefault();
        setError("");

        const formData = new FormData(event.currentTarget);

        startTransition(async () => {
          try {
            await deleteBeat(formData);
            router.refresh();
          } catch (submitError) {
            setError(
              submitError instanceof Error ? submitError.message : "Delete failed. Please try again."
            );
          }
        });
      }}
    >
      <input type="hidden" name="id" value={beatId} />
      <Button type="submit" variant="destructive" disabled={isPending}>
        {isPending ? "Deleting..." : "Delete beat"}
      </Button>
      <div className="text-xs text-foreground/45">
        {hasOrders
          ? "Order snapshots stay intact even after the original beat is deleted."
          : "Deletes the beat record and its uploaded preview and cover assets."}
      </div>
      {error ? <div className="text-xs text-red-300/90">{error}</div> : null}
    </form>
  );
}
