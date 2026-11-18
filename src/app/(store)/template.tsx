/** Re-mounts on every navigation, so each page fades/blurs in. */
export default function StoreTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
