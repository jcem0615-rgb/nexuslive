import Link from 'next/link';
import { AuthShell } from '@/components/AuthShell';
import { ResetFlow } from './ResetFlow';

export const metadata = { title: 'Reset your password' };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll send a six-digit code to your email."
      footer={
        <Link href="/login" className="font-semibold text-nexus-300 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <ResetFlow />
    </AuthShell>
  );
}
