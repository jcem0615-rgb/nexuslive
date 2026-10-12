import { requireUser } from '@/lib/auth';
import { ok, parseJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { notificationsReadSchema } from '@/lib/validators';

export const runtime = 'nodejs';

/** Marks the given notifications read, or every unread one when ids are omitted. */
export const POST = route(async (req) => {
  const user = await requireUser();
  const { ids } = await parseJson(req, notificationsReadSchema);

  const result = await prisma.notification.updateMany({
    // Scoped to the caller, so an id from somebody else's list does nothing.
    where: { userId: user.id, readAt: null, ...(ids?.length ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  });

  return ok({ marked: result.count });
});
