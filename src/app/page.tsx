import { redirect } from "next/navigation";
import Link from "next/link";

interface HomeProps {
  searchParams: Promise<{
    code?: string;
    error?: string;
    error_code?: string;
    error_description?: string;
  }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;

  // If there's a code parameter, redirect to auth callback
  if (params.code) {
    const callbackUrl = new URL("/auth/callback", "http://localhost:3000");
    callbackUrl.searchParams.set("code", params.code);
    redirect(callbackUrl.pathname + callbackUrl.search);
  }

  // If there's an error, redirect to login with error params
  if (params.error || params.error_code) {
    const loginUrl = new URL("/login", "http://localhost:3000");
    if (params.error) loginUrl.searchParams.set("error", params.error);
    if (params.error_code) loginUrl.searchParams.set("error_code", params.error_code);
    if (params.error_description) loginUrl.searchParams.set("error_description", params.error_description);
    redirect(loginUrl.pathname + loginUrl.search);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-4">Shift Management App</h1>
      <p className="text-muted-foreground mb-8">
        Employee shift management and time tracking application
      </p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          Sign In
        </Link>
        <Link
          href="/signup"
          className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
        >
          Sign Up
        </Link>
      </div>
    </main>
  );
}
