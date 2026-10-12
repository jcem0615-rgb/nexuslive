import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { isMasterAdmin } from '@/lib/session';
import { TopBar } from '@/components/TopBar';
import { Card, PageHeader } from '@/components/ui';
import { CONTENT_POLICY_BODY, CONTENT_POLICY_TITLE, STRIKE_LADDER } from '@/lib/economy';
import { maskPhone } from '@/lib/phone';
import { ProfileForm } from './ProfileForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Edit profile' };

export default async function SettingsPage() {
  const user = await getUser();
  if (!user) redirect('/login?next=%2Fsettings');

  const restricted = user.restrictedUntil && user.restrictedUntil > new Date();

  return (
    <>
      <TopBar user={user} isOwner={isMasterAdmin(user)} />

      <main className="mx-auto max-w-2xl px-4 py-6">
        <PageHeader title="Edit profile" subtitle="How you show up across Nexus Live." />

        {restricted && (
          <Card className="mb-4 border-amber-400/40 bg-amber-400/10">
            <p className="text-sm font-bold text-amber-300">Your account is restricted</p>
            <p className="mt-1 text-xs text-amber-200/80">
              You cannot go live, take a seat, chat or send gifts until{' '}
              {user.restrictedUntil!.toLocaleString()}. Your wallet is untouched.
            </p>
          </Card>
        )}

        <ProfileForm
          user={{
            displayName: user.displayName,
            username: user.username,
            bio: user.bio ?? '',
            gender: user.gender,
            country: user.country ?? '',
            avatarUrl: user.avatarUrl ?? '',
            phoneMasked: user.phone ? maskPhone(user.phone) : null,
          }}
        />

        <Card className="mt-6">
          <h2 className="text-sm font-bold text-white">{CONTENT_POLICY_TITLE}</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{CONTENT_POLICY_BODY}</p>
          <ol className="mt-3 space-y-1.5">
            {STRIKE_LADDER.map((rung) => (
              <li key={rung.offence} className="flex items-center gap-2 text-xs">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 font-bold text-slate-300">
                  {rung.offence}
                </span>
                <span className={rung.action === 'BAN' ? 'font-semibold text-live' : 'text-slate-300'}>
                  {rung.label}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[11px] text-slate-600">
            Strikes do not expire. Serving a restriction does not move you back down the ladder.
          </p>
        </Card>
      </main>
    </>
  );
}
