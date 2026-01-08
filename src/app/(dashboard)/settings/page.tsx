import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { PushNotificationSettings } from "@/components/settings/push-notifications";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAuthData } from "@/lib/auth";

export default async function SettingsPage() {
  const authData = await getAuthData();

  if (!authData) {
    redirect("/login");
  }

  const { user } = authData;

  return (
    <>
      <DashboardHeader title="Settings" />
      <div className="container mx-auto p-6">
        <Tabs defaultValue="notifications" className="space-y-6">
          <TabsList>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
          </TabsList>

          <TabsContent value="notifications" className="space-y-6">
            <PushNotificationSettings userId={user.id} />
          </TabsContent>

          <TabsContent value="preferences" className="space-y-6">
            <div className="text-muted-foreground">
              Additional preferences coming soon.
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
