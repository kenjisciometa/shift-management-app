import { redirect } from "next/navigation";
import { DashboardNav } from "@/components/dashboard/nav";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { getAuthData } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authData = await getAuthData();

  if (!authData) {
    redirect("/login");
  }

  if (!authData.profile.organization_id) {
    redirect("/onboarding");
  }

  return (
    <SidebarProvider>
      <DashboardNav user={{ id: authData.user.id, email: authData.user.email }} profile={authData.profile} />
      <main className="flex-1 overflow-auto md:peer-data-[state=expanded]:ml-64 md:peer-data-[state=collapsed]:ml-0 transition-[margin] duration-200 ease-linear">
        {children}
      </main>
      <Toaster />
    </SidebarProvider>
  );
}
