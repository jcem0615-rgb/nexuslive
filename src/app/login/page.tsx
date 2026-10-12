import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { AuthShell } from '@/components/AuthShell';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await getUser()) redirect('/');
  const { next } = await searchParams;

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to pick up where you left off."
      footer={
        <>
          New here?{' '}
          <Link href="/signup" className="font-semibold text-nexus-300 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm next={next} />
    </AuthShell>
  );
}
