import { getUser } from '@/lib/auth';
import { ok, route } from '@/lib/http';
import { hostLevel, senderLevel } from '@/lib/economy';
import { isMasterAdmin } from '@/lib/session';

export const runtime = 'nodejs';

export const GET = route(async () => {
  const user = await getUser();
  if (!user) return ok({ user: null });
  return ok({
    user: {
      ...user,
      isMasterAdmin: isMasterAdmin(user),
      senderLevel: senderLevel(user.totalSpent),
      hostLevel: hostLevel(user.totalEarned),
    },
  });
});
