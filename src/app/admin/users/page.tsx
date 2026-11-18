import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { ActionButton } from "@/components/forms/action-button";
import { StatusBadge } from "@/components/ui/badges";
import { PageTitle } from "@/components/ui/section";

export const metadata = { title: "Users" };

export default async function AdminUsers(props: PageProps<"/admin/users">) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const me = await getCurrentUser();
  const users = await db.user.findMany({
    where: q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { seller: { select: { status: true, storeName: true } }, _count: { select: { orders: true, products: true } } },
  });
  return (
    <div>
      <PageTitle title="Users" subtitle="Suspending a user signs them out everywhere and archives their live listings.">
        <form><input name="q" defaultValue={q} placeholder="Search name or email" className="input w-64" /></form>
      </PageTitle>
      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>User</th><th>Role</th><th>Seller</th><th>Orders</th><th>Listings</th><th>Wallet</th><th>Status</th><th /></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><p className="font-medium">{u.name}</p><p className="text-xs text-muted">{u.email}</p></td>
                <td>{u.role}</td>
                <td>{u.seller ? <><StatusBadge status={u.seller.status} /><p className="text-xs text-muted">{u.seller.storeName}</p></> : "—"}</td>
                <td>{u._count.orders}</td><td>{u._count.products}</td><td>{formatINR(u.walletBalance)}</td>
                <td><StatusBadge status={u.status} /></td>
                <td className="whitespace-nowrap">
                  {u.id !== me?.id && (
                    <div className="flex gap-2">
                      {u.status === "ACTIVE"
                        ? <ActionButton url={`/api/admin/users/${u.id}`} body={{ status: "SUSPENDED" }} variant="danger" label="Suspend" confirm={`Suspend ${u.email}?`} success="User suspended" />
                        : <ActionButton url={`/api/admin/users/${u.id}`} body={{ status: "ACTIVE" }} label="Reactivate" success="User reactivated" />}
                      {u.role !== "ADMIN" && <ActionButton url={`/api/admin/users/${u.id}`} body={{ role: "ADMIN" }} variant="ghost" label="Make admin" confirm={`Grant full admin access to ${u.email}?`} success="Role updated" />}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
