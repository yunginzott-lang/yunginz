import { LoginForm } from "@/components/admin/login-form";

export default async function AdminLoginPage({
  searchParams
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = params.callbackUrl || "/admin";

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-24">
      <div className="section-kicker">Admin access</div>
      <h1 className="mt-6 text-6xl font-semibold uppercase text-[#f4efe7]">
        Control room
      </h1>
      <p className="mt-4 text-2xl text-foreground/60">
        Sign in to manage beats, licenses, orders, and homepage content.
      </p>
      <LoginForm callbackUrl={callbackUrl} />
    </main>
  );
}
