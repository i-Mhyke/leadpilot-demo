import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { Firm } from "@leadpilot/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clearStoredSessionsForFirm } from "@/features/chat/hooks/use-demo-sessions";
import { deleteFirmProvisioning } from "./server";

export function FirmDeleteSection(props: {
  firm: Firm;
  onDeleted?: () => void;
}) {
  const deleteFirm = useServerFn(deleteFirmProvisioning);
  const [confirmSlug, setConfirmSlug] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const slugMatches = confirmSlug.trim() === props.firm.slug;

  async function handleDelete() {
    if (!slugMatches) {
      setDeleteError(`Type "${props.firm.slug}" to confirm deletion.`);
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteFirm({
        data: {
          firmSlug: props.firm.slug,
        },
      });
      clearStoredSessionsForFirm(props.firm.slug);
      props.onDeleted?.();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Delete failed. Try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section className="border-destructive/20 bg-destructive/5 mt-6 rounded-2xl border p-4">
      <h3 className="text-destructive text-sm font-semibold tracking-tight">Danger zone</h3>
      <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
        Permanently delete <strong>{props.firm.name}</strong> and all persisted conversations,
        leads, knowledge base data, and brain config for this tenant.
      </p>

      <label className="mt-4 block space-y-2">
        <span className="text-foreground text-xs font-medium tracking-[0.08em] uppercase">
          Type <code className="font-mono normal-case">{props.firm.slug}</code> to confirm
        </span>
        <Input
          value={confirmSlug}
          onChange={(event) => setConfirmSlug(event.target.value)}
          placeholder={props.firm.slug}
          autoComplete="off"
          spellCheck={false}
          disabled={isDeleting}
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="destructive"
          className="rounded-full px-4"
          onClick={() => void handleDelete()}
          disabled={isDeleting || !slugMatches}
        >
          {isDeleting ? "Deleting..." : "Delete firm"}
        </Button>
        {!slugMatches && confirmSlug.trim() ? (
          <p className="text-muted-foreground text-xs">Slug must match exactly.</p>
        ) : null}
      </div>

      {deleteError ? (
        <p
          className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {deleteError}
        </p>
      ) : null}
    </section>
  );
}
