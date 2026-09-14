import { AuthForm } from "@/components/auth-form";
import { db } from "@/lib/db";
import { hash } from "@/lib/crypto";
import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await db.invitation.findUnique({
    where: { tokenHash: hash(token) },
    include: { client: true },
  });
  if (
    !invite ||
    invite.revokedAt ||
    invite.acceptedAt ||
    invite.expiresAt < new Date()
  )
    return (
      <main className="standalone">
        <h1>Invitation unavailable</h1>
        <p>
          This invitation has expired, was revoked, or has already been
          accepted.
        </p>
        <Link href="/login">Sign in</Link>
      </main>
    );
  return (
    <AuthForm
      mode="invite"
      token={token}
      invite={{
        name: invite.name,
        email: invite.email,
        company: invite.client.company,
      }}
    />
  );
}
