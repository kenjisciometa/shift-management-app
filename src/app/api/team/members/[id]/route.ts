import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser, isAdminUser } from "@/app/api/shared/rbac";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/team/members/[id]
 * Get a specific team member's details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { error: authError, user, profile, supabase } =
      await authenticateAndAuthorize(request);

    if (authError || !user || !profile || !supabase) {
      return (
        authError ||
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    if (!isPrivilegedUser(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const { data: member, error: fetchError } = await supabase
      .from("profiles")
      .select(`
        id,
        email,
        first_name,
        last_name,
        display_name,
        avatar_url,
        phone,
        role,
        status,
        hire_date,
        employee_code,
        employment_type,
        hourly_rate,
        department_id,
        allow_time_edit,
        auto_clock_out_enabled,
        auto_clock_out_time,
        notification_settings,
        created_at,
        updated_at,
        department:departments!profiles_department_id_fkey (id, name),
        user_positions (
          id,
          is_primary,
          wage_rate,
          position:positions (id, name, color)
        ),
        user_locations (
          id,
          location:locations (id, name)
        )
      `)
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Member not found" },
          { status: 404 }
        );
      }
      console.error("Error fetching member:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch member" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: member });
  } catch (error) {
    console.error("Error in GET /api/team/members/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

interface UpdateMemberRequest {
  first_name?: string;
  last_name?: string;
  display_name?: string;
  phone?: string;
  role?: string;
  status?: string;
  hire_date?: string;
  employee_code?: string;
  employment_type?: string;
  hourly_rate?: number;
  department_id?: string | null;
  allow_time_edit?: boolean;
  auto_clock_out_enabled?: boolean;
  auto_clock_out_time?: string;
}

/**
 * PUT /api/team/members/[id]
 * Update a team member (admin only)
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

    // Only admin and owner can update members
    if (!isAdminUser(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body: UpdateMemberRequest = await request.json();

    // Check member exists and belongs to organization
    const { data: existingMember, error: checkError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (checkError || !existingMember) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.first_name !== undefined) updateData.first_name = body.first_name;
    if (body.last_name !== undefined) updateData.last_name = body.last_name;
    if (body.display_name !== undefined) updateData.display_name = body.display_name;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.role !== undefined) updateData.role = body.role;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.hire_date !== undefined) updateData.hire_date = body.hire_date;
    if (body.employee_code !== undefined) updateData.employee_code = body.employee_code;
    if (body.employment_type !== undefined) updateData.employment_type = body.employment_type;
    if (body.hourly_rate !== undefined) updateData.hourly_rate = body.hourly_rate;
    if (body.department_id !== undefined) updateData.department_id = body.department_id;
    if (body.allow_time_edit !== undefined) updateData.allow_time_edit = body.allow_time_edit;
    if (body.auto_clock_out_enabled !== undefined) updateData.auto_clock_out_enabled = body.auto_clock_out_enabled;
    if (body.auto_clock_out_time !== undefined) updateData.auto_clock_out_time = body.auto_clock_out_time;

    // Update member
    const { data: member, error: updateError } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", id)
      .select(`
        id,
        email,
        first_name,
        last_name,
        display_name,
        avatar_url,
        phone,
        role,
        status,
        hire_date,
        employee_code,
        employment_type,
        hourly_rate,
        department_id,
        department:departments!profiles_department_id_fkey (id, name)
      `)
      .single();

    if (updateError) {
      console.error("Error updating member:", updateError);
      return NextResponse.json(
        { error: "Failed to update member" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: member });
  } catch (error) {
    console.error("Error in PUT /api/team/members/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/team/members/[id]
 * Deactivate a team member (admin only)
 * Note: This doesn't delete the user, just sets status to 'inactive'
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

    // Only admin and owner can deactivate members
    if (!isAdminUser(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Can't deactivate yourself
    if (id === user.id) {
      return NextResponse.json(
        { error: "Cannot deactivate yourself" },
        { status: 400 }
      );
    }

    // Check member exists and belongs to organization
    const { data: existingMember, error: checkError } = await supabase
      .from("profiles")
      .select("id, status")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (checkError || !existingMember) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    if (existingMember.status === "inactive") {
      return NextResponse.json(
        { error: "Member already inactive" },
        { status: 400 }
      );
    }

    // Deactivate member
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        status: "inactive",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error("Error deactivating member:", updateError);
      return NextResponse.json(
        { error: "Failed to deactivate member" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/team/members/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
