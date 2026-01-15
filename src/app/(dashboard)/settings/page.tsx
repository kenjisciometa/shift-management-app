import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { PushNotificationSettings } from "@/components/settings/push-notifications";
import { TeamNotificationSettingsComponent } from "@/components/settings/team-notification-settings";
import { TeamSettingsComponent } from "@/components/settings/team-settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAuthData } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const authData = await getAuthData();

  if (!authData) {
    redirect("/login");
  }

  const { user, profile } = authData;
  const supabase = await createClient();

  // Fetch organization settings for team settings
  const { data: organization } = await supabase
    .from("organizations")
    .select("id, settings")
    .eq("id", profile.organization_id)
    .single();

  return (
    <>
      <DashboardHeader title="Settings" />
      <div className="container mx-auto p-6">
        <Tabs defaultValue="notifications" className="space-y-6">
          <TabsList>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
          </TabsList>

          <TabsContent value="notifications" className="space-y-6">
            <PushNotificationSettings userId={user.id} />
            {organization && (
              <TeamNotificationSettingsComponent
                organizationId={organization.id}
                initialSettings={organization.settings}
              />
            )}
          </TabsContent>

          <TabsContent value="schedule" className="space-y-6">
            {organization && (
              <TeamSettingsComponent
                organizationId={organization.id}
                initialSettings={organization.settings}
              />
            )}
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
