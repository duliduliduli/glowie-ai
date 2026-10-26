/** Shared shell for the legal pages. */
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <article className="rounded-[28px] bg-card p-6 shadow-sm md:p-10 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_li]:mt-1 [&_p]:mt-3 [&_p]:text-muted-foreground [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-muted-foreground">
        <h1 className="heading text-3xl">{title}</h1>
        <p className="!mt-2 text-sm">Last updated October 26, 2026</p>
        {children}
      </article>
    </main>
  );
}
