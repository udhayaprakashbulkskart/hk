"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import { Play, Rotate3d, ZoomIn } from "lucide-react";

type Media = { id: string; url: string; type: "IMAGE" | "VIDEO" | "SPIN"; alt: string | null };

/** Product gallery: images, an optional video, and a drag-to-rotate 360° viewer when SPIN frames exist. */
export function ProductGallery({ media, title }: { media: Media[]; title: string }) {
  const images = media.filter((m) => m.type === "IMAGE");
  const video = media.find((m) => m.type === "VIDEO");
  const frames = media.filter((m) => m.type === "SPIN");
  type View = { kind: "image"; i: number } | { kind: "video" } | { kind: "spin" };
  const [view, setView] = useState<View>(frames.length >= 8 ? { kind: "spin" } : { kind: "image", i: 0 });
  const current = view.kind === "image" ? (images[view.i] ?? images[0]) : null;

  return (
    <div className="space-y-3">
      <div className="card relative aspect-[4/3] overflow-hidden bg-[radial-gradient(ellipse_at_50%_85%,rgba(242,193,78,0.25),transparent_60%),radial-gradient(circle_at_50%_35%,#8b1420,#2a070b_75%)]">
        {view.kind === "spin" ? (
          <SpinViewer frames={frames.map((f) => f.url)} title={title} />
        ) : view.kind === "video" && video ? (
          <video src={video.url} controls playsInline className="size-full object-contain" />
        ) : current ? (
          <ZoomImage key={current.id} src={current.url} alt={current.alt ?? title} />
        ) : null}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {frames.length >= 8 && (
          <Thumb active={view.kind === "spin"} onClick={() => setView({ kind: "spin" })} label="360° view">
            <Rotate3d className="size-6 text-neon" />
          </Thumb>
        )}
        {images.map((m, i) => (
          <Thumb key={m.id} active={view.kind === "image" && view.i === i} onClick={() => setView({ kind: "image", i })} label={`Image ${i + 1}`}>
            <Image src={m.url} alt="" fill sizes="96px" className="object-contain p-1" unoptimized={m.url.endsWith(".svg") || m.url.startsWith("/uploads/")} />
          </Thumb>
        ))}
        {video && (
          <Thumb active={view.kind === "video"} onClick={() => setView({ kind: "video" })} label="Video">
            <Play className="size-6 fill-white text-white" />
          </Thumb>
        )}
      </div>
    </div>
  );
}

/** Hover (desktop) or tap (touch) to zoom 2.2× around the pointer. */
function ZoomImage({ src, alt }: { src: string; alt: string }) {
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
  };
  return (
    <div
      className={clsx("absolute inset-0 overflow-hidden", zoom ? "cursor-zoom-out" : "cursor-zoom-in")}
      onPointerEnter={(e) => e.pointerType === "mouse" && setZoom(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setZoom(false)}
      onPointerMove={move}
      onClick={(e) => { if ((e.nativeEvent as PointerEvent).pointerType !== "mouse") setZoom((z) => !z); }}
      role="img"
      aria-label={alt}
    >
      <Image
        src={src}
        alt={alt}
        fill
        priority
        sizes="(max-width: 1024px) 100vw, 50vw"
        style={{ transformOrigin: origin, transform: zoom ? "scale(2.2)" : "none" }}
        className="object-contain p-4 drop-shadow-[0_20px_40px_rgba(0,0,0,0.7)] transition-transform duration-200 ease-out"
        unoptimized={src.endsWith(".svg") || src.startsWith("/uploads/")}
      />
      {!zoom && (
        <span className="pointer-events-none absolute right-3 bottom-3 flex items-center gap-1 rounded-full border border-neon/40 bg-[#1c0507]/80 px-2.5 py-1 text-[11px] text-neon-soft">
          <ZoomIn className="size-3.5" /> Hover or tap to zoom
        </span>
      )}
    </div>
  );
}

function Thumb({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} aria-pressed={active} className={clsx("relative grid h-16 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border bg-panel-2 transition", active ? "border-neon shadow-neon" : "border-line hover:border-zinc-500")}>
      {children}
    </button>
  );
}

function SpinViewer({ frames, title }: { frames: string[]; title: string }) {
  const [frame, setFrame] = useState(0);
  const drag = useRef<{ x: number; f: number } | null>(null);
  const step = (dx: number) => Math.round(dx / 12);
  useEffect(() => {
    frames.forEach((src) => {
      const img = new window.Image();
      img.src = src;
    });
  }, [frames]);
  const set = (f: number) => setFrame(((f % frames.length) + frames.length) % frames.length);
  return (
    <div
      className="relative size-full cursor-grab touch-none select-none active:cursor-grabbing"
      role="slider"
      tabIndex={0}
      aria-label={`360° view of ${title}. Use arrow keys or drag to rotate.`}
      aria-valuemin={0}
      aria-valuemax={frames.length - 1}
      aria-valuenow={frame}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") set(frame - 1);
        if (e.key === "ArrowRight") set(frame + 1);
      }}
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, f: frame };
      }}
      onPointerMove={(e) => drag.current && set(drag.current.f + step(e.clientX - drag.current.x))}
      onPointerUp={() => (drag.current = null)}
    >
      {/* One frame in the DOM at a time; the rest are preloaded into the browser cache. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={frames[frame]} alt="" draggable={false} className="absolute inset-0 size-full object-cover" />
      <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/15 bg-black/60 px-3 py-1 text-xs font-semibold backdrop-blur">
        <Rotate3d className="size-4 text-neon" /> 360° · drag to rotate
      </div>
    </div>
  );
}
