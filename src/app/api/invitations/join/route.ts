import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface JoinOrganizationRequest {
  token: string;
}

/**
 * POST /api/invitations/join
 * Join an organization using an invitation token
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: JoinOrganizationRequest = await request.json();

    if (!body.token) {
      return NextResponse.json(
        { error: "Invitation token is required" },
        { status: 400 }
      );
    }

    // Find the invitation
    const { data: invitation, error: inviteError } = await supabase
      .from("employee_invitations")
      .select("*, organizations(*)")
      .eq("token", body.token)
      .eq("status", "pending")
      .single();

    if (inviteError || !invitation) {
      return NextResponse.json(
        { error: "Invalid or expired invitation code" },
        { status: 404 }
      );
    }

    // Check if invitation has expired
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "This invitation has expired" },
        { status: 400 }
      );
    }

    // Check if user already has a profile
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, organization_id")
      .eq("id", user.id)
      .single();

    if (existingProfile?.organization_id) {
      return NextResponse.json(
        { error: "You are already a member of an organization" },
        { status: 400 }
      );
    }

    // Create or update the user profile
    if (existingProfile) {
      // Update existing profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          organization_id: invitation.organization_id,
          department_id: invitation.department_id,
          role: invitation.role || "employee",
          status: "active",
        })
        .eq("id", user.id);

      if (updateError) {
        console.error("Error updating profile:", updateError);
        return NextResponse.json(
          { error: "Failed to join organization" },
          { status: 500 }
        );
      }
    } else {
      // Create new profile
      const { error: profileError } = await supabase.from("profiles").insert({
        id: user.id,
        email: user.email!,
        first_name:
          user.user_metadata?.first_name || invitation.email.split("@")[0],
        last_name: user.user_metadata?.last_name || "",
        organization_id: invitation.organization_id,
        department_id: invitation.department_id,
        role: invitation.role || "employee",
        status: "active",
      });

      if (profileError) {
        console.error("Error creating profile:", profileError);
        return NextResponse.json(
          { error: "Failed to join organization" },
          { status: 500 }
        );
      }
    }

    // Update invitation status
    await supabase
      .from("employee_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in POST /api/invitations/join:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
