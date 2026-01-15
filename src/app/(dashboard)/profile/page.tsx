import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { ProfileSettings } from "@/components/profile/settings";
import { getAuthData } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const authData = await getAuthData();

  if (!authData) {
    redirect("/login");
  }

  const { user, profile } = authData;
  const supabase = await createClient();

  // Fetch department info if assigned
  let department = null;
  if (profile.department_id) {
    const { data } = await supabase
      .from("departments")
      .select("id, name")
      .eq("id", profile.department_id)
      .single();
    department = data;
  }

  // Fetch assigned locations
  const { data: userLocations } = await supabase
    .from("user_locations")
    .select(`
      location_id,
      is_primary,
      locations (id, name)
    `)
    .eq("user_id", user.id);

  return (
    <>
      <DashboardHeader title="My Profile" />
      <div className="container mx-auto p-6 max-w-3xl">
        <ProfileSettings
          user={{ id: user.id, email: user.email || "" }}
          profile={profile}
          department={department}
          userLocations={userLocations || []}
        />
      </div>
    </>
  );
}
