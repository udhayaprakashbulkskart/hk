import { GridSkeleton } from "@/components/ui/states";

export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-9 w-56" />
      <div className="skeleton h-12 w-full rounded-full" />
      <GridSkeleton />
    </div>
  );
}
