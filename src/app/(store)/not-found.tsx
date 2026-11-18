import { EmptyState } from "@/components/ui/states";

export default function NotFound() {
  return (
    <div className="py-10">
      <EmptyState title="Not found" body="This page or item doesn't exist, or it's no longer listed." action={{ href: "/marketplace", label: "Browse marketplace" }} />
    </div>
  );
}
