import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { PushNotificationSettings } from "@/components/settings/push-notifications";
import { TeamNotificationSettingsComponent } from "@/components/settings/team-notification-settings";
import { TeamSettingsComponent } from "@/components/settings/team-settings";
import { ShiftSwapSettingsComponent } from "@/components/settings/shift-swap-settings";
import { ClockInSettings } from "@/components/settings/clock-in-settings";
import { PreferencesSettings } from "@/components/settings/preferences-settings";
import { PTOPolicyManager } from "@/components/pto/policy-manager";
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
  const isAdmin = profile.role === "admin" || profile.role === "owner" || profile.role === "manager";

  // Fetch organization settings, PTO policies, and user preferences in parallel
  const [organizationResult, ptoPoliciesResult, preferencesResult] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, settings")
      .eq("id", profile.organization_id)
      .single(),
    isAdmin
      ? supabase
          .from("pto_policies")
          .select("*")
          .eq("organization_id", profile.organization_id)
          .order("name")
      : Promise.resolve({ data: null }),
    supabase
      .from("profiles")
      .select("preferences")
      .eq("id", user.id)
      .single(),
  ]);

  const organization = organizationResult.data;
  const ptoPolicies = ptoPoliciesResult.data || [];
  const userPreferences = preferencesResult.data?.preferences || {};

  return (
    <>
      <DashboardHeader title="Settings" />
      <div className="container mx-auto p-6">
        <Tabs defaultValue="notifications" className="space-y-6">
          <TabsList>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="shift-swap">Shift Swap</TabsTrigger>
            {isAdmin && <TabsTrigger value="clock-in">Clock-in</TabsTrigger>}
            {isAdmin && <TabsTrigger value="pto-policies">PTO Policies</TabsTrigger>}
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

          <TabsContent value="shift-swap" className="space-y-6">
            {organization && (
              <ShiftSwapSettingsComponent
                organizationId={organization.id}
                initialSettings={organization.settings}
              />
            )}
          </TabsContent>

          {isAdmin && (
            <TabsContent value="clock-in" className="space-y-6">
              {organization && (
                <ClockInSettings organizationId={organization.id} />
              )}
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="pto-policies" className="space-y-6">
              {organization && (
                <PTOPolicyManager
                  policies={ptoPolicies}
                  organizationId={organization.id}
                />
              )}
            </TabsContent>
          )}

          <TabsContent value="preferences" className="space-y-6">
            <PreferencesSettings
              userId={user.id}
              initialPreferences={userPreferences}
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
