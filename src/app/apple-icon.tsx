import { ImageResponse } from "next/og";
import { BrandMark } from "@/components/brand-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS applies its own rounded mask, so draw a full square.
export default function AppleIcon() {
  return new ImageResponse(<BrandMark size={180} radius={0} />, size);
}
