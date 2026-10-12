import { requireUser } from '@/lib/auth';
import { ok, parseJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { updateProfileSchema } from '@/lib/validators';

export const runtime = 'nodejs';

export const PATCH = route(async (req) => {
  const user = await requireUser();
  const body = await parseJson(req, updateProfileSchema);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
      ...(body.bio !== undefined ? { bio: body.bio } : {}),
      ...(body.gender !== undefined ? { gender: body.gender } : {}),
      ...(body.country !== undefined ? { country: body.country } : {}),
      ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl || null } : {}),
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      bio: true,
      gender: true,
      country: true,
      avatarUrl: true,
    },
  });

  return ok({ user: updated });
});
