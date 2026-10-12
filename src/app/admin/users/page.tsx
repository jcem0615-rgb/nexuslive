import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui';
import { UserRow } from './UserRow';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Users' };

const PER_PAGE = 25;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page } = await searchParams;
  const current = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);

  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: 'insensitive' as const } },
          { username: { contains: q, mode: 'insensitive' as const } },
          { displayName: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: PER_PAGE,
      skip: (current - 1) * PER_PAGE,
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        role: true,
        purchasedDiamonds: true,
        earnedDiamonds: true,
        isLocked: true,
        lockedReason: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <>
      <PageHeader title="Users" subtitle={`${total} account${total === 1 ? '' : 's'}`} />

      <form method="get" className="mb-4 flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ''}
          className="input"
          placeholder="Search email, username or name"
        />
        <button type="submit" className="btn-ghost shrink-0">
          Search
        </button>
      </form>

      <ul className="space-y-2">
        {users.map((user) => (
          <UserRow key={user.id} user={{ ...user, createdAt: user.createdAt.toISOString() }} />
        ))}
      </ul>

      {pages > 1 && (
        <nav className="mt-5 flex justify-center gap-2" aria-label="Pagination">
          {current > 1 && (
            <a
              href={`/admin/users?page=${current - 1}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className="btn-ghost text-xs"
            >
              Previous
            </a>
          )}
          <span className="self-center text-xs text-slate-500">
            Page {current} of {pages}
          </span>
          {current < pages && (
            <a
              href={`/admin/users?page=${current + 1}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className="btn-ghost text-xs"
            >
              Next
            </a>
          )}
        </nav>
      )}
    </>
  );
}
