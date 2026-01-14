import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const errorCode = requestUrl.searchParams.get("error_code");
  const errorDescription = requestUrl.searchParams.get("error_description");
  const origin = requestUrl.origin;
  const redirectTo = requestUrl.searchParams.get("redirect_to")?.toString();

  // Handle auth errors (e.g., expired link)
  if (error || errorCode) {
    const errorParams = new URLSearchParams();
    if (error) errorParams.set("error", error);
    if (errorCode) errorParams.set("error_code", errorCode);
    if (errorDescription) errorParams.set("error_description", errorDescription);
    return NextResponse.redirect(`${origin}/login?${errorParams.toString()}`);
  }

  if (code) {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.exchangeCodeForSession(code);

    if (authError) {
      const errorParams = new URLSearchParams();
      errorParams.set("error", "auth_error");
      errorParams.set("error_description", authError.message);
      return NextResponse.redirect(`${origin}/login?${errorParams.toString()}`);
    }

    if (authData?.user) {
      const adminSupabase = createAdminClient();

      // Check if user has a profile with an organization
      const { data: profile } = await adminSupabase
        .from("profiles")
        .select("organization_id")
        .eq("id", authData.user.id)
        .single();

      // If no profile, check for pending invitation
      if (!profile) {
        const userEmail = authData.user.email?.toLowerCase();

        if (userEmail) {
          // Check for pending invitation
          const { data: invitation } = await adminSupabase
            .from("employee_invitations")
            .select("*")
            .eq("email", userEmail)
            .eq("status", "pending")
            .single();

          if (invitation) {
            // Create profile from invitation
            const { error: profileError } = await adminSupabase
              .from("profiles")
              .insert({
                id: authData.user.id,
                organization_id: invitation.organization_id,
                department_id: invitation.department_id,
                email: invitation.email,
                first_name: invitation.first_name || "",
                last_name: invitation.last_name || "",
                role: invitation.role || "employee",
                status: "active",
              });

            if (!profileError) {
              // Mark invitation as accepted
              await adminSupabase
                .from("employee_invitations")
                .update({
                  status: "accepted",
                  accepted_at: new Date().toISOString(),
                })
                .eq("id", invitation.id);

              // Redirect to dashboard
              return NextResponse.redirect(`${origin}/dashboard`);
            }
          }
        }

        // No invitation found, redirect to onboarding
        return NextResponse.redirect(`${origin}/onboarding`);
      }

      // Profile exists but no organization
      if (!profile.organization_id) {
        return NextResponse.redirect(`${origin}/onboarding`);
      }
    }
  }

  if (redirectTo) {
    return NextResponse.redirect(`${origin}${redirectTo}`);
  }

  // URL to redirect to after sign up process completes
  return NextResponse.redirect(`${origin}/dashboard`);
}
