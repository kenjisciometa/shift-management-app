import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isAdminUser } from "@/app/api/shared/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomBytes } from "crypto";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface UpdateInvitationRequest {
  status?: "cancelled";
  resend?: boolean;
}

/**
 * PUT /api/team/invitations/[id]
 * Update an invitation (admin only)
 * - Set status to cancelled
 * - Resend invitation (regenerate token and extend expiry)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { error: authError, user, profile, supabase } =
      await authenticateAndAuthorize(request);

    if (authError || !user || !profile || !supabase) {
      return (
        authError ||
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    // Only admin and owner can update invitations
    if (!isAdminUser(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body: UpdateInvitationRequest = await request.json();

    // Check invitation exists and belongs to organization
    const { data: existingInvitation, error: checkError } = await supabase
      .from("employee_invitations")
      .select("id, status, email, first_name, last_name")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (checkError || !existingInvitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    if (existingInvitation.status === "accepted") {
      return NextResponse.json(
        { error: "Cannot modify accepted invitation" },
        { status: 400 }
      );
    }

    // Handle resend
    if (body.resend) {
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

      const { data: invitation, error: updateError } = await supabase
        .from("employee_invitations")
        .update({
          token,
          expires_at: expiresAt.toISOString(),
          status: "pending",
        })
        .eq("id", id)
        .select()
        .single();

      if (updateError) {
        console.error("Error resending invitation:", updateError);
        return NextResponse.json(
          { error: "Failed to resend invitation" },
          { status: 500 }
        );
      }

      // Send invitation email via Supabase Auth
      try {
        const adminClient = createAdminClient();

        // Get app URL from request or environment
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ||
          `${request.headers.get("x-forwarded-proto") || "https"}://${request.headers.get("host")}`;

        const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
          existingInvitation.email,
          {
            redirectTo: `${appUrl}/invite/${token}`,
            data: {
              first_name: existingInvitation.first_name || "",
              last_name: existingInvitation.last_name || "",
              invitation_token: token,
            },
          }
        );

        if (inviteError) {
          console.error("Error sending invitation email:", inviteError);
          return NextResponse.json({
            success: true,
            data: invitation,
            warning: "Invitation updated but email could not be sent."
          });
        }
      } catch (emailError) {
        console.error("Error with invitation email:", emailError);
        return NextResponse.json({
          success: true,
          data: invitation,
          warning: "Invitation updated but email could not be sent."
        });
      }

      return NextResponse.json({ success: true, data: invitation });
    }

    // Handle status update (cancel)
    if (body.status === "cancelled") {
      const { data: invitation, error: updateError } = await supabase
        .from("employee_invitations")
        .update({ status: "cancelled" })
        .eq("id", id)
        .select()
        .single();

      if (updateError) {
        console.error("Error cancelling invitation:", updateError);
        return NextResponse.json(
          { error: "Failed to cancel invitation" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, data: invitation });
    }

    return NextResponse.json(
      { error: "No valid update operation specified" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error in PUT /api/team/invitations/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/team/invitations/[id]
 * Cancel/delete an invitation (admin only)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { error: authError, user, profile, supabase } =
      await authenticateAndAuthorize(request);

    if (authError || !user || !profile || !supabase) {
      return (
        authError ||
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    // Only admin and owner can delete invitations
    if (!isAdminUser(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Check invitation exists and belongs to organization
    const { data: existingInvitation, error: checkError } = await supabase
      .from("employee_invitations")
      .select("id, status")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (checkError || !existingInvitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    if (existingInvitation.status === "accepted") {
      return NextResponse.json(
        { error: "Cannot delete accepted invitation" },
        { status: 400 }
      );
    }

    // Delete invitation
    const { error: deleteError } = await supabase
      .from("employee_invitations")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting invitation:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete invitation" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/team/invitations/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
