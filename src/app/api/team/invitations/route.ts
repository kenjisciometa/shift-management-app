import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isAdminUser } from "@/app/api/shared/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomBytes } from "crypto";

/**
 * GET /api/team/invitations
 * Get pending invitations (admin and owner only)
 *
 * Query params:
 * - status: 'pending' | 'accepted' | 'expired' | 'all' (optional, default 'pending')
 * - limit: number (optional, default 50)
 * - offset: number (optional, default 0)
 */
export async function GET(request: NextRequest) {
  try {
    const { error: authError, user, profile, supabase } =
      await authenticateAndAuthorize(request);

    if (authError || !user || !profile || !supabase) {
      return (
        authError ||
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    // Only admin and owner can view invitations
    if (!isAdminUser(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query
    let query = supabase
      .from("employee_invitations")
      .select(`
        id,
        email,
        first_name,
        last_name,
        phone,
        role,
        status,
        employee_code,
        department_id,
        expires_at,
        created_at,
        accepted_at,
        department:departments (id, name),
        invited_by_user:profiles!employee_invitations_invited_by_fkey (id, first_name, last_name)
      `, { count: "exact" })
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by status
    if (status !== "all") {
      query = query.eq("status", status);
    }

    const { data: invitations, error: fetchError, count } = await query;

    if (fetchError) {
      console.error("Error fetching invitations:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch invitations" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: invitations || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/team/invitations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

interface CreateInvitationRequest {
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  role?: string;
  employee_code?: string;
  department_id?: string;
}

/**
 * POST /api/team/invitations
 * Create a new invitation (admin and owner only)
 */
export async function POST(request: NextRequest) {
  try {
    const { error: authError, user, profile, supabase } =
      await authenticateAndAuthorize(request);

    if (authError || !user || !profile || !supabase) {
      return (
        authError ||
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    // Only admin and owner can create invitations
    if (!isAdminUser(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body: CreateInvitationRequest = await request.json();
    const { email, first_name, last_name, phone, role, employee_code, department_id } = body;

    if (!email) {
      return NextResponse.json(
        { error: "email is required" },
        { status: 400 }
      );
    }

    // Check if email already exists in profiles
    const { data: existingUser } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email.toLowerCase())
      .eq("organization_id", profile.organization_id)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    // Check if there's already a pending invitation
    const { data: existingInvitation } = await supabase
      .from("employee_invitations")
      .select("id")
      .eq("email", email.toLowerCase())
      .eq("organization_id", profile.organization_id)
      .eq("status", "pending")
      .single();

    if (existingInvitation) {
      return NextResponse.json(
        { error: "Pending invitation already exists for this email" },
        { status: 400 }
      );
    }

    // Generate token and expiry
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    // Create invitation
    const { data: invitation, error: insertError } = await supabase
      .from("employee_invitations")
      .insert({
        organization_id: profile.organization_id,
        email: email.toLowerCase(),
        first_name: first_name || null,
        last_name: last_name || null,
        phone: phone || null,
        role: role || "employee",
        employee_code: employee_code || null,
        department_id: department_id || null,
        token,
        expires_at: expiresAt.toISOString(),
        invited_by: user.id,
        status: "pending",
      })
      .select(`
        id,
        email,
        first_name,
        last_name,
        phone,
        role,
        status,
        employee_code,
        department_id,
        expires_at,
        created_at,
        token,
        department:departments (id, name)
      `)
      .single();

    if (insertError) {
      console.error("Error creating invitation:", insertError);
      return NextResponse.json(
        { error: "Failed to create invitation" },
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
        email.toLowerCase(),
        {
          redirectTo: `${appUrl}/invite/${token}`,
          data: {
            first_name: first_name || "",
            last_name: last_name || "",
            invitation_token: token,
          },
        }
      );

      if (inviteError) {
        console.error("Error sending invitation email:", inviteError);
        // Don't fail the whole request - invitation is created, just email failed
        // The admin can resend later
        return NextResponse.json({
          success: true,
          data: invitation,
          warning: "Invitation created but email could not be sent. You can resend the invitation."
        }, { status: 201 });
      }
    } catch (emailError) {
      console.error("Error with invitation email:", emailError);
      // Same as above - don't fail the whole request
      return NextResponse.json({
        success: true,
        data: invitation,
        warning: "Invitation created but email could not be sent. You can resend the invitation."
      }, { status: 201 });
    }

    return NextResponse.json({ success: true, data: invitation }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/team/invitations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
