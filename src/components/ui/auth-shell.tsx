import Image from "next/image";
import { LogoMark } from "@/components/ui/logo";

/** Auth page frame: form card + full-length render on a neon pedestal (desktop). */
export function AuthShell({ title, subtitle, render, children }: { title: string; subtitle: string; render: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-5xl items-center gap-10 py-6 lg:grid-cols-2">
      <div className="card p-6 sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <LogoMark className="size-12" />
          <h1 className="heading mt-3 text-3xl">{title}</h1>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>
        {children}
      </div>
      <div className="relative hidden h-[560px] lg:block" aria-hidden>
        <div className="absolute inset-x-[15%] bottom-6 h-10 rounded-[50%] bg-[radial-gradient(ellipse,rgba(245,179,1,0.55),rgba(255,122,26,0.2)_50%,transparent_70%)]" />
        <div className="absolute inset-x-[22%] bottom-9 h-4 rounded-[50%] border border-mint/60 shadow-[0_0_24px_rgba(245,179,1,0.6)]" />
        <Image src={render} alt="" fill sizes="40vw" className="animate-float object-contain object-bottom pb-10 drop-shadow-[0_20px_40px_rgba(0,0,0,0.7)]" />
      </div>
    </div>
  );
}
