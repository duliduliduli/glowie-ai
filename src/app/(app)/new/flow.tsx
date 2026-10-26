"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { ChevronLeft, ImageUp, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Camera } from "@/components/camera";
import { Turnstile } from "@/components/turnstile";
import { VIBES } from "@/lib/config";
import { cn } from "@/lib/utils";

type Photo = { id: string; url: string; fromCamera: boolean };
type Props = {
  initialVibe: string | null;
  prices: { analysis: number; looks: number; image: number };
  balance: number;
  trial: boolean;
  turnstileSiteKey: string | null;
};

const OCCASIONS = ["Everyday", "Work", "Date", "Party", "Wedding", "Vacation"];
const BUDGETS = ["Budget", "Mid-range", "Luxury"];
const HIGHLIGHTS = ["Eyes", "Lips", "Cheekbones", "Hair", "Smile", "Shoulders", "Waist", "Legs"];
const STEPS = ["Selfie", "Full body", "Vibe", "About you", "Review"];

async function upload(blob: Blob, kind: "selfie" | "fullbody", fromCamera: boolean): Promise<Photo> {
  const form = new FormData();
  form.set("file", blob, "photo.jpg");
  form.set("kind", kind);
  form.set("fromCamera", fromCamera ? "1" : "0");
  const res = await fetch("/api/photos", { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Upload failed");
  return data;
}

function Chip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn("min-h-11 rounded-full px-4 text-sm font-medium transition", on ? "bg-primary text-primary-foreground" : "bg-card shadow-sm")}
    >
      {children}
    </button>
  );
}

export function NewLookFlow({ initialVibe, prices, balance, trial, turnstileSiteKey }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<Photo | null>(null);
  const [fullBody, setFullBody] = useState<Photo | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [vibe, setVibe] = useState<string | null>(initialVibe);
  const [customPrompt, setCustomPrompt] = useState("");
  const [occasion, setOccasion] = useState("Everyday");
  const [budget, setBudget] = useState("Mid-range");
  const [highlight, setHighlight] = useState<string[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const fileSelfie = useRef<HTMLInputElement>(null);
  const fileBody = useRef<HTMLInputElement>(null);

  const cost = prices.analysis + prices.looks;
  const enough = balance >= cost;
  const onCameraError = useCallback((r: string) => setCameraError(r), []);

  const doUpload = async (blob: Blob, kind: "selfie" | "fullbody", fromCamera: boolean) => {
    setBusy(kind === "selfie" ? "Checking your photo..." : "Checking it's you...");
    try {
      const p = await upload(blob, kind, fromCamera);
      if (kind === "selfie") setSelfie(p);
      else setFullBody(p);
      setStep((s) => s + 1);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const start = async () => {
    setBusy("Starting your session...");
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selfieId: selfie!.id,
          fullBodyId: fullBody?.id,
          vibe,
          customPrompt: vibe === "custom" ? customPrompt : null,
          quiz: { occasion, budget, highlight },
          useTrial: trial,
          turnstileToken: token,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/session/${data.id}`);
    } catch (e) {
      toast.error((e as Error).message || "Something went wrong");
      setBusy(null);
    }
  };

  const canNext = [!!selfie, true, !!vibe && (vibe !== "custom" || customPrompt.trim().length > 2), true][step];

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex items-center gap-2 pb-2 pt-6">
        {step > 0 ? (
          <Button variant="ghost" size="icon" aria-label="Back" onClick={() => setStep(step - 1)}>
            <ChevronLeft />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" aria-label="Close" asChild>
            <Link href="/home"><ChevronLeft /></Link>
          </Button>
        )}
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Step {step + 1} of {STEPS.length}</p>
          <h1 className="heading text-xl">{STEPS[step]}</h1>
        </div>
      </div>
      <div className="mb-5 flex gap-1.5" aria-hidden>
        {STEPS.map((s, i) => (
          <span key={s} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-border")} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }} className="space-y-5">
          {busy ? (
            <div className="grid min-h-[50dvh] place-items-center text-center" role="status">
              <div className="space-y-3">
                <Loader2 className="mx-auto size-10 animate-spin text-accent" aria-hidden />
                <p className="font-semibold">{busy}</p>
              </div>
            </div>
          ) : step === 0 ? (
            <>
              <p className="text-sm text-muted-foreground">Face the light, no sunglasses, just you in the frame. A live selfie lets us make AI previews of you.</p>
              {cameraError ? (
                <p className="rounded-2xl bg-accent-soft p-4 text-sm">{cameraError}</p>
              ) : (
                <Camera onCapture={(b) => doUpload(b, "selfie", true)} onUnavailable={onCameraError} />
              )}
              <input ref={fileSelfie} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && doUpload(e.target.files[0], "selfie", false)} />
              <Button variant={cameraError ? "default" : "ghost"} size="lg" className="w-full" onClick={() => fileSelfie.current?.click()}>
                <ImageUp aria-hidden /> Upload a photo instead
              </Button>
              {!cameraError ? <p className="text-center text-xs text-muted-foreground">Uploaded photos get the analysis and looks; previews need a live selfie.</p> : null}
            </>
          ) : step === 1 ? (
            <>
              <p className="text-sm text-muted-foreground">Optional: add a full-length photo of yourself for outfit previews. It must be the same person as your selfie.</p>
              <div className="grid aspect-[4/5] place-items-center overflow-hidden rounded-[28px] bg-card shadow-sm">
                {fullBody ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fullBody.url} alt="Your full-body photo" className="size-full object-cover" />
                ) : (
                  <ImageUp className="size-12 text-muted-foreground" aria-hidden />
                )}
              </div>
              <input ref={fileBody} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && doUpload(e.target.files[0], "fullbody", false)} />
              <Button size="lg" variant="white" className="w-full" onClick={() => fileBody.current?.click()}>
                {fullBody ? "Choose a different photo" : "Add full-body photo"}
              </Button>
              <Button size="lg" className="w-full" onClick={() => setStep(2)}>
                {fullBody ? "Continue" : "Skip for now"}
              </Button>
            </>
          ) : step === 2 ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                {VIBES.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    aria-pressed={vibe === v.id}
                    onClick={() => setVibe(v.id)}
                    className={cn("min-h-16 rounded-[20px] px-4 text-left font-semibold shadow-sm transition active:scale-[0.98]", vibe === v.id ? "bg-primary text-primary-foreground" : "bg-card")}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
              {vibe === "custom" ? (
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Describe your vibe</span>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    maxLength={300}
                    rows={3}
                    placeholder="e.g. Parisian café in autumn, minimal jewellery"
                    className="w-full rounded-2xl border bg-card p-4 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                </label>
              ) : null}
            </>
          ) : step === 3 ? (
            <>
              <fieldset className="space-y-3">
                <legend className="pb-2 font-semibold">Occasion</legend>
                <div className="flex flex-wrap gap-2">{OCCASIONS.map((o) => <Chip key={o} on={occasion === o} onClick={() => setOccasion(o)}>{o}</Chip>)}</div>
              </fieldset>
              <fieldset className="space-y-3">
                <legend className="pb-2 font-semibold">Budget</legend>
                <div className="flex flex-wrap gap-2">{BUDGETS.map((b) => <Chip key={b} on={budget === b} onClick={() => setBudget(b)}>{b}</Chip>)}</div>
              </fieldset>
              <fieldset className="space-y-3">
                <legend className="pb-2 font-semibold">What do you love to highlight?</legend>
                <div className="flex flex-wrap gap-2">
                  {HIGHLIGHTS.map((h) => (
                    <Chip key={h} on={highlight.includes(h)} onClick={() => setHighlight((x) => (x.includes(h) ? x.filter((y) => y !== h) : [...x, h].slice(-5)))}>
                      {h}
                    </Chip>
                  ))}
                </div>
              </fieldset>
            </>
          ) : (
            <>
              <div className="flex gap-4 rounded-[28px] bg-card p-4 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selfie!.url} alt="Your selfie" className="aspect-[4/5] w-24 rounded-2xl object-cover" />
                <div className="space-y-1 text-sm">
                  <p className="font-bold">{VIBES.find((v) => v.id === vibe)?.label}</p>
                  <p className="text-muted-foreground">{occasion} · {budget}</p>
                  {highlight.length ? <p className="text-muted-foreground">Highlight: {highlight.join(", ")}</p> : null}
                  {fullBody ? <p className="text-muted-foreground">+ full-body photo</p> : null}
                </div>
              </div>
              <div className="space-y-2 rounded-[28px] bg-card p-5 shadow-sm">
                <h2 className="font-bold">Price</h2>
                <Row label="Colour & face analysis" value={trial ? "Free" : `up to ${prices.analysis} cr`} />
                <Row label="3 complete looks" value={trial ? "Free" : `up to ${prices.looks} cr`} />
                <Row label="Each AI preview image (later, optional)" value={`up to ${prices.image} cr`} />
                <p className="pt-2 text-xs text-muted-foreground">
                  {trial ? "Your first analysis is on us." : `You're charged actual cost, never more than shown. Balance: ${balance} credits. Failed generations are never charged.`}
                </p>
              </div>
              {trial && turnstileSiteKey ? <Turnstile siteKey={turnstileSiteKey} onToken={setToken} /> : null}
              {trial || enough ? (
                <Button size="lg" className="w-full" onClick={start} disabled={trial && !!turnstileSiteKey && !token}>
                  {trial ? "Analyse me, free" : `Analyse me · up to ${cost} credits`}
                </Button>
              ) : (
                <Button size="lg" className="w-full" asChild>
                  <Link href="/credits">Add credits to continue</Link>
                </Button>
              )}
              <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="size-4" aria-hidden /> Private by default. Never used for AI training.
              </p>
            </>
          )}
          {!busy && step >= 2 && step <= 3 ? (
            <Button size="lg" className="w-full" disabled={!canNext} onClick={() => setStep(step + 1)}>
              Continue
            </Button>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
