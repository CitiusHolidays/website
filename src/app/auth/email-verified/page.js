import EmailVerifiedPageClient from './page.client';

export const metadata = {
  title: 'Email Verified',
  description: 'Your Citius Holidays email address has been verified.',
};

export default function EmailVerifiedPage() {
  return <EmailVerifiedPageClient />;
}
