import Image from "next/image";

/** next/image wrapper; SVG placeholders and local uploads skip the optimiser. */
export function MediaImage({ src, alt, className, sizes, priority }: { src: string; alt: string; className?: string; sizes?: string; priority?: boolean }) {
  const unoptimized = src.endsWith(".svg") || src.startsWith("/uploads/");
  return <Image src={src} alt={alt} fill sizes={sizes ?? "(max-width: 768px) 50vw, 25vw"} className={className} unoptimized={unoptimized} priority={priority} />;
}
