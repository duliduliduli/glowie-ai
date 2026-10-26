"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adjustCredits } from "./actions";

export function AdjustForm() {
  const [state, action, pending] = useActionState(adjustCredits, null);
  return (
    <form action={action} className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="email">User email</Label>
        <Input id="email" name="email" type="email" required className="h-11" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="amount">Credits (negative to deduct)</Label>
        <Input id="amount" name="amount" type="number" step={1} required className="h-11" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="note">Note</Label>
        <Input id="note" name="note" maxLength={200} className="h-11" />
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Apply"}</Button>
      {state && <p role="status" className={state.ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>{state.message}</p>}
    </form>
  );
}
