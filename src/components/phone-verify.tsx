"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PhoneNumberResource = Awaited<ReturnType<NonNullable<ReturnType<typeof useUser>["user"]>["createPhoneNumber"]>>;

/** Adds and verifies a phone number on the Clerk account (SMS code). Needed for the free trial. */
export function PhoneVerify({ onVerified }: { onVerified: () => void }) {
  const { user } = useUser();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<PhoneNumberResource | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      const err = e as { errors?: { longMessage?: string }[]; message?: string };
      toast.error(err.errors?.[0]?.longMessage ?? err.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const send = () =>
    run(async () => {
      const p = user!.phoneNumbers.find((x) => x.phoneNumber === phone) ?? (await user!.createPhoneNumber({ phoneNumber: phone }));
      await p.prepareVerification();
      setPending(p);
    });

  const verify = () =>
    run(async () => {
      const p = await pending!.attemptVerification({ code });
      if (p.verification.status !== "verified") throw new Error("That code didn't work");
      await user!.reload();
      onVerified();
    });

  return (
    <div className="space-y-3 rounded-[24px] bg-card p-5 shadow-sm">
      <h2 className="font-bold">Verify your phone to unlock the free trial</h2>
      <p className="text-sm text-muted-foreground">One free trial per person. We only use your number to prevent abuse, never for marketing.</p>
      {pending ? (
        <>
          <Input inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} className="h-11" aria-label="Verification code" />
          <Button className="w-full" disabled={busy || code.length < 6} onClick={verify}>Verify</Button>
        </>
      ) : (
        <>
          <Input type="tel" autoComplete="tel" placeholder="+1 555 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11" aria-label="Phone number" />
          <Button className="w-full" disabled={busy || phone.replace(/\D/g, "").length < 8} onClick={send}>Text me a code</Button>
        </>
      )}
    </div>
  );
}
