import { ok, route } from '@/lib/http';
import { GIFTS, GIFT_BEAN_RATE, MAX_GIFT_QUANTITY, beansForGift } from '@/lib/economy';

export const runtime = 'nodejs';

export const GET = route(async () =>
  ok({
    gifts: GIFTS.map((gift) => ({ ...gift, beansForReceiver: beansForGift(gift.diamonds) })),
    beanRate: GIFT_BEAN_RATE,
    maxQuantity: MAX_GIFT_QUANTITY,
  }),
);
