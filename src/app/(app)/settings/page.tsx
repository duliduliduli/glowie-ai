import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { ChevronRight } from "lucide-react";
import { isAdmin, requireUser } from "@/lib/auth";
import { PHOTO_RETENTION_DAYS } from "@/lib/config";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { DeleteAccount, DeletePhotos, DeleteImmediately } from "./client";

export const metadata = { title: "Profile" };

export default async function SettingsPage() {
  const user = await requireUser();
  const links = [
    ["/credits", "Credits & purchase history"],
    ["/privacy", "Privacy policy"],
    ["/terms", "Terms of service"],
    ["/cookies", "Cookies"],
    ...(isAdmin(user.email) ? [["/admin", "Admin dashboard"]] : []),
  ];
  return (
    <div className="space-y-6">
      <PageHeader title="Profile" subtitle={user.email} />

      <section className="space-y-4 rounded-[24px] bg-card p-5 shadow-sm">
        <h2 className="font-bold">Your photos</h2>
        <p className="text-sm text-muted-foreground">
          Photos are private, only shown through links that expire, and never used to train AI. Originals are deleted automatically after {PHOTO_RETENTION_DAYS} days.
        </p>
        <DeleteImmediately on={user.deleteOriginalsImmediately} />
        <DeletePhotos />
      </section>

      <nav aria-label="More" className="divide-y rounded-[24px] bg-card px-4 shadow-sm">
        {links.map(([href, label]) => (
          <Link key={href} href={href} className="flex min-h-14 items-center justify-between text-sm font-medium">
            {label} <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
          </Link>
        ))}
      </nav>

      <SignOutButton>
        <Button variant="white" size="lg" className="w-full">Sign out</Button>
      </SignOutButton>

      <section className="space-y-3 rounded-[24px] border border-destructive/20 p-5">
        <h2 className="font-bold">Delete account</h2>
        <p className="text-sm text-muted-foreground">Permanently deletes your login, every photo, all looks and your credit balance. Unused credits are not refunded. This can&apos;t be undone.</p>
        <DeleteAccount />
      </section>
    </div>
  );
}
