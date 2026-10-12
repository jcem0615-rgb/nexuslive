import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { AuthShell } from '@/components/AuthShell';
import { SignupForm } from './SignupForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Create an account' };

export default async function SignupPage() {
  if (await getUser()) redirect('/');

  return (
    <AuthShell
      title="Join Nexus Live"
      subtitle="Takes a minute. Your welcome diamonds are waiting."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-nexus-300 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
