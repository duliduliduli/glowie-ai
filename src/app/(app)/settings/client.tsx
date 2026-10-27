"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { deleteAccount, deleteAllPhotos, setDeleteImmediately } from "../actions";

export function DeleteImmediately({ on }: { on: boolean }) {
  const [checked, setChecked] = useState(on);
  const [pending, start] = useTransition();
  return (
    <label className="flex min-h-11 items-center justify-between gap-4 text-sm">
      <span>
        <span className="block font-medium">Delete originals right after my looks are ready</span>
        <span className="text-muted-foreground">You won&apos;t be able to make new previews from that session.</span>
      </span>
      <Switch checked={checked} disabled={pending} onCheckedChange={(v) => { setChecked(v); start(async () => { try { await setDeleteImmediately(v); } catch { setChecked(!v); toast.error("Couldn't save that. Please try again."); } }); }} />
    </label>
  );
}

export function DeletePhotos() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      className="w-full"
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete all your photos and previews now? Your looks and palettes stay.")) return;
        start(async () => {
          toast.success(`Deleted ${await deleteAllPhotos()} photos`);
        });
      }}
    >
      {pending ? "Deleting..." : "Delete all my photos now"}
    </Button>
  );
}

export function DeleteAccount() {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive" className="w-full">Delete my account</Button>
      </DialogTrigger>
      <DialogContent className="rounded-[28px]">
        <DialogTitle>Delete your account?</DialogTitle>
        <DialogDescription>Type DELETE to permanently remove your account, photos and data.</DialogDescription>
        <Input value={text} onChange={(e) => setText(e.target.value)} aria-label="Type DELETE to confirm" autoCapitalize="characters" className="h-11" />
        <Button
          variant="destructive"
          disabled={text !== "DELETE" || pending}
          onClick={() =>
            start(async () => {
              const r = await deleteAccount(text);
              if (r?.error) toast.error(r.error);
            })
          }
        >
          {pending ? "Deleting..." : "Delete forever"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
