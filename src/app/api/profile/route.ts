import { requireUser } from '@/lib/auth';
import { ok, parseJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { updateProfileSchema } from '@/lib/validators';
import { normalisePhone } from '@/lib/phone';
import { AppError } from '@/lib/http';

export const runtime = 'nodejs';

export const PATCH = route(async (req) => {
  const user = await requireUser();
  const body = await parseJson(req, updateProfileSchema);

  // Username and phone are identity, not decoration: both stay unique, and
  // changing one has to clear the same bar signup does.
  const phone = body.phone === undefined ? undefined : normalisePhone(body.phone);

  if (phone !== undefined || body.username !== undefined) {
    const clash = await prisma.user.findFirst({
      where: {
        id: { not: user.id },
        OR: [
          ...(phone !== undefined ? [{ phone }] : []),
          ...(body.username !== undefined ? [{ username: body.username }] : []),
        ],
      },
      select: { username: true, phone: true },
    });
    if (clash) {
      throw AppError.conflict(
        clash.phone === phone
          ? 'That phone number is already registered'
          : 'That username is taken',
      );
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
      ...(body.username !== undefined ? { username: body.username } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(body.bio !== undefined ? { bio: body.bio } : {}),
      ...(body.gender !== undefined ? { gender: body.gender } : {}),
      ...(body.country !== undefined ? { country: body.country } : {}),
      ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl || null } : {}),
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      phone: true,
      bio: true,
      gender: true,
      country: true,
      avatarUrl: true,
    },
  });

  return ok({ user: updated });
});
