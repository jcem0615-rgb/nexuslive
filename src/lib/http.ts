/**
 * Route plumbing: one error type and one wrapper, so every handler under
 * src/app/api returns a predictable JSON shape and never leaks a stack trace.
 *
 * Rule 9: wrap every handler in route() and throw AppError for anything the
 * caller should see.
 */
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { ZodError, type ZodType } from 'zod';

export class AppError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code = 'error',
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(400, message, 'bad_request', details);
  }
  static unauthorized(message = 'Sign in to continue') {
    return new AppError(401, message, 'unauthorized');
  }
  static forbidden(message = 'Not allowed') {
    return new AppError(403, message, 'forbidden');
  }
  static notFound(message = 'Not found') {
    return new AppError(404, message, 'not_found');
  }
  static conflict(message: string, details?: unknown) {
    return new AppError(409, message, 'conflict', details);
  }
  static tooMany(message = 'Slow down a moment') {
    return new AppError(429, message, 'rate_limited');
  }
  /** Not enough diamonds or beans — common enough to name. */
  static insufficient(message = 'Not enough balance') {
    return new AppError(402, message, 'insufficient_funds');
  }
}

/** Rule 8: no API response is ever cacheable, by the SW or anything else. */
const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
} as const;

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

export function fail(status: number, message: string, code = 'error', details?: unknown) {
  return NextResponse.json({ error: { code, message, details } }, { status, headers: NO_STORE });
}

type Handler<Ctx> = (req: Request, ctx: Ctx) => Promise<NextResponse> | NextResponse;

/**
 * Catches everything a handler can throw and turns it into JSON:
 *   AppError            -> its own status
 *   ZodError            -> 400 with field errors
 *   Prisma P2002        -> 409 (unique constraint)
 *   Prisma P2025        -> 404 (missing row)
 *   anything else       -> 500, logged server-side, opaque to the caller
 */
export function route<Ctx = unknown>(handler: Handler<Ctx>) {
  return async (req: Request, ctx: Ctx): Promise<NextResponse> => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof AppError) {
        return fail(err.status, err.message, err.code, err.details);
      }
      if (err instanceof ZodError) {
        return fail(400, 'Check the highlighted fields', 'validation_error', err.flatten().fieldErrors);
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          const target = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'value';
          return fail(409, `That ${target} is already taken`, 'conflict');
        }
        if (err.code === 'P2025') {
          return fail(404, 'Not found', 'not_found');
        }
      }
      console.error('[api] unhandled error', err);
      return fail(500, 'Something went wrong on our side', 'internal_error');
    }
  };
}

/** Parse and validate a JSON body. Throws a ZodError that route() renders. */
export async function parseJson<S extends ZodType>(req: Request, schema: S): Promise<ReturnType<S['parse']>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw AppError.badRequest('Expected a JSON body');
  }
  return schema.parse(raw) as ReturnType<S['parse']>;
}

/** Best-effort client IP, for audit rows. */
export function clientIp(req: Request): string | undefined {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim();
  return req.headers.get('x-real-ip') ?? undefined;
}

/** Positive integer query param with a cap, for pagination. */
export function intParam(url: URL, key: string, fallback: number, max: number): number {
  const raw = url.searchParams.get(key);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}
