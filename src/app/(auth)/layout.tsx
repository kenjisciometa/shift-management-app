export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Let middleware handle redirects - removing server-side redirect check
  // to avoid conflicts with cookie syncing after login
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {children}
    </div>
  );
}
