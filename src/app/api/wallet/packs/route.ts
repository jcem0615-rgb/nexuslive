import { ok, route } from '@/lib/http';
import { DIAMOND_PACKS, packTotalDiamonds } from '@/lib/economy';

export const runtime = 'nodejs';

export const GET = route(async () =>
  ok({
    packs: DIAMOND_PACKS.map((pack) => ({ ...pack, total: packTotalDiamonds(pack) })),
    checkoutEnabled: false,
  }),
);
