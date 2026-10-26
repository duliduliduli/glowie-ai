"use client";

import { useEffect, useRef, useState } from "react";
import { Camera as CameraIcon, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Live front-camera capture. Calls onCapture with a JPEG blob. Falls back to onUnavailable if no camera/permission. */
export function Camera({ onCapture, onUnavailable }: { onCapture: (b: Blob) => void; onUnavailable: (reason: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream: MediaStream | undefined;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1600 } }, audio: false })
      .then((s) => {
        stream = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch(() => onUnavailable("Camera unavailable. Allow camera access or upload a photo."));
    if (!navigator.mediaDevices) onUnavailable("This browser can't open the camera. Upload a photo instead.");
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [onUnavailable]);

  const snap = () => {
    const v = video.current;
    if (!v) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d")!;
    // Un-mirror so the saved photo matches reality.
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0);
    c.toBlob((b) => b && onCapture(b), "image/jpeg", 0.9);
  };

  return (
    <div className="space-y-4">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[28px] bg-black">
        <video ref={video} autoPlay playsInline muted onLoadedData={() => setReady(true)} className="size-full -scale-x-100 object-cover" aria-label="Camera preview" />
        <div aria-hidden className="pointer-events-none absolute inset-[18%_22%] rounded-[50%] border-2 border-dashed border-white/60" />
        {!ready ? <RefreshCw className="absolute inset-0 m-auto size-8 animate-spin text-white/70" aria-hidden /> : null}
      </div>
      <Button size="lg" className="w-full" onClick={snap} disabled={!ready}>
        <CameraIcon aria-hidden /> Take selfie
      </Button>
    </div>
  );
}
