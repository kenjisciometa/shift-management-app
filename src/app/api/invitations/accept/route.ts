import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  console.log("=== Accept Invitation API called ===");

  try {
    const body = await request.json();
    const { userId, invitationId, token } = body;

    console.log("Request body:", { userId, invitationId, token: token ? "***" : "missing" });

    if (!userId || !invitationId || !token) {
      console.log("Missing required fields");
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Auto-confirm user email for invited users
    console.log("Confirming email for user:", userId);
    const { error: confirmError } = await supabase.auth.admin.updateUserById(
      userId,
      { email_confirm: true }
    );

    if (confirmError) {
      console.error("Email confirmation error:", confirmError);
      // Continue anyway - user might already be confirmed
    } else {
      console.log("Email confirmed successfully");
    }

    // Verify the invitation exists and is valid
    console.log("Looking for invitation:", invitationId);
    const { data: invitation, error: invitationError } = await supabase
      .from("employee_invitations")
      .select("*")
      .eq("id", invitationId)
      .eq("token", token)
      .eq("status", "pending")
      .single();

    console.log("Invitation query result:", { invitation: !!invitation, error: invitationError?.message });

    if (invitationError || !invitation) {
      console.log("Invalid or expired invitation");
      return NextResponse.json(
        { error: "Invalid or expired invitation" },
        { status: 400 }
      );
    }

    // Check if invitation has expired
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "Invitation has expired" },
        { status: 400 }
      );
    }

    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single();

    if (!existingProfile) {
      // Create the profile using admin client (bypasses RLS)
      const { error: profileError } = await supabase.from("profiles").insert({
        id: userId,
        organization_id: invitation.organization_id,
        department_id: invitation.department_id,
        first_name: invitation.first_name || "",
        last_name: invitation.last_name || "",
        email: invitation.email,
        role: invitation.role || "employee",
        status: "active",
      });

      if (profileError) {
        console.error("Profile creation error:", profileError);
        return NextResponse.json(
          { error: "Failed to create profile" },
          { status: 500 }
        );
      }
    } else {
      // Update existing profile with organization info
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          organization_id: invitation.organization_id,
          department_id: invitation.department_id,
          role: invitation.role || "employee",
          status: "active",
        })
        .eq("id", userId);

      if (updateError) {
        console.error("Profile update error:", updateError);
        return NextResponse.json(
          { error: "Failed to update profile" },
          { status: 500 }
        );
      }
    }

    // Mark invitation as accepted
    console.log("Marking invitation as accepted");
    const { error: acceptError } = await supabase
      .from("employee_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    if (acceptError) {
      console.error("Invitation update error:", acceptError);
      // Non-fatal error, continue anyway
    }

    console.log("=== Accept Invitation API completed successfully ===");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Accept invitation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
