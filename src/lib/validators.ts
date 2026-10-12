/**
 * Every request body is parsed through one of these (rule 9).
 * Length and range limits that are economy numbers come from economy.ts.
 */
import { z } from 'zod';
import {
  CHAT_MESSAGE_MAX_LENGTH,
  CLAN_NAME_MAX,
  CLAN_NAME_MIN,
  CLAN_TAG_MAX,
  CLAN_TAG_MIN,
  MAX_GIFT_QUANTITY,
  MIN_CASHOUT_BEANS,
  PASSWORD_MIN_LENGTH,
  STREAM_TITLE_MAX_LENGTH,
} from './economy';

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email');

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `At least ${PASSWORD_MIN_LENGTH} characters`)
  .max(128, 'That password is too long');

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'At least 3 characters')
  .max(20, 'At most 20 characters')
  .regex(/^[a-z0-9_]+$/, 'Letters, numbers and underscores only');

export const genderSchema = z.enum(['UNSPECIFIED', 'FEMALE', 'MALE', 'OTHER']);

export const signupSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1, 'Tell us your name').max(40),
  gender: genderSchema.optional(),
  country: z.string().trim().length(2).toUpperCase().optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password'),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  email: emailSchema,
  otp: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
  password: passwordSchema,
});

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(40).optional(),
  bio: z.string().trim().max(200).optional(),
  gender: genderSchema.optional(),
  country: z.string().trim().length(2).toUpperCase().optional(),
  avatarUrl: z.string().url().max(500).optional().or(z.literal('')),
});

export const sendGiftSchema = z.object({
  giftCode: z.string().trim().min(1).max(32),
  receiverId: z.string().trim().min(1).max(40),
  streamId: z.string().trim().min(1).max(40).optional(),
  quantity: z.number().int().min(1).max(MAX_GIFT_QUANTITY).default(1),
});

export const playGameSchema = z.object({
  game: z.enum(['LUCKY_SPIN', 'TREASURE_CHEST', 'LUCKY_NUMBER']),
  pick: z.number().int().min(1).max(100).optional(),
});

export const startStreamSchema = z.object({
  title: z.string().trim().min(1, 'Give your stream a title').max(STREAM_TITLE_MAX_LENGTH),
  category: z.string().trim().min(1).max(40).default('Just Chatting'),
});

export const chatSchema = z.object({
  body: z.string().trim().min(1, 'Say something').max(CHAT_MESSAGE_MAX_LENGTH),
});

export const createClanSchema = z.object({
  name: z.string().trim().min(CLAN_NAME_MIN).max(CLAN_NAME_MAX),
  tag: z
    .string()
    .trim()
    .toUpperCase()
    .min(CLAN_TAG_MIN)
    .max(CLAN_TAG_MAX)
    .regex(/^[A-Z0-9]+$/, 'Letters and numbers only'),
  description: z.string().trim().max(200).optional(),
});

export const purchaseSchema = z.object({
  packCode: z.string().trim().min(1).max(32),
});

export const cashoutSchema = z.object({
  beans: z.number().int().min(MIN_CASHOUT_BEANS, `Minimum ${MIN_CASHOUT_BEANS} beans`),
  method: z.enum(['PAYPAL', 'BANK', 'GCASH', 'USDT']),
  payoutHandle: z.string().trim().min(3, 'Where should we send it?').max(120),
});

export const reportSchema = z.object({
  targetUserId: z.string().trim().max(40).optional(),
  streamId: z.string().trim().max(40).optional(),
  reason: z.string().trim().min(3).max(60),
  details: z.string().trim().max(500).optional(),
});

// ---------------------------------------------------------------- admin

export const adminLockSchema = z.object({
  locked: z.boolean(),
  reason: z.string().trim().max(200).optional(),
});

export const adminAdjustSchema = z.object({
  wallet: z.enum(['PURCHASED', 'EARNED']),
  amount: z.number().int().refine((n) => n !== 0, 'Amount must not be zero'),
  memo: z.string().trim().min(3, 'Say why').max(200),
});

/** Rule 4: MASTER_ADMIN is deliberately absent — no endpoint may grant it. */
export const adminRoleSchema = z.object({
  role: z.enum(['USER', 'HOST', 'MODERATOR']),
});

export const adminCashoutSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'MARK_PAID']),
  note: z.string().trim().max(200).optional(),
});

export const adminReportSchema = z.object({
  status: z.enum(['REVIEWING', 'RESOLVED', 'DISMISSED']),
});

export const adminSettingSchema = z.object({
  key: z.string().trim().min(1).max(60),
  value: z.unknown(),
});
