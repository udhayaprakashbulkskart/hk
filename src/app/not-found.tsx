import Link from "next/link";

export default function RootNotFound() {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <p className="font-display text-7xl font-bold text-neon">404</p>
        <h1 className="heading mt-2 text-2xl">Out of the zone</h1>
        <p className="mt-2 text-sm text-muted">This page doesn&apos;t exist.</p>
        <Link href="/" className="btn-primary mt-5">Back to DROPZONE</Link>
      </div>
    </div>
  );
}
