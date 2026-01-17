import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";

interface PublishShiftsRequest {
  shift_ids?: string[];
  start_date?: string;
  end_date?: string;
  user_id?: string;
  location_id?: string;
  department_id?: string;
}

/**
 * POST /api/shifts/publish
 * Publish shifts (admin/manager only)
 *
 * Can publish by:
 * - shift_ids: specific shift IDs
 * - date range + optional filters: all draft shifts matching criteria
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

    if (!isPrivilegedUser(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body: PublishShiftsRequest = await request.json();
    const { shift_ids, start_date, end_date, user_id, location_id, department_id } = body;

    const now = new Date().toISOString();

    if (shift_ids && shift_ids.length > 0) {
      // Publish specific shifts
      const { data: shifts, error: updateError } = await supabase
        .from("shifts")
        .update({
          is_published: true,
          published_at: now,
          updated_at: now,
        })
        .eq("organization_id", profile.organization_id)
        .eq("is_published", false)
        .in("id", shift_ids)
        .select(`
          *,
          user:profiles!shifts_user_id_fkey (id, first_name, last_name, display_name, avatar_url),
          location:locations (id, name),
          department:departments (id, name),
          position:positions (id, name, color)
        `);

      if (updateError) {
        console.error("Error publishing shifts:", updateError);
        return NextResponse.json(
          { error: "Failed to publish shifts" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: shifts || [],
        publishedCount: shifts?.length || 0,
      });
    } else if (start_date && end_date) {
      // Publish by date range with optional filters
      let query = supabase
        .from("shifts")
        .update({
          is_published: true,
          published_at: now,
          updated_at: now,
        })
        .eq("organization_id", profile.organization_id)
        .eq("is_published", false)
        .gte("start_time", `${start_date}T00:00:00`)
        .lte("start_time", `${end_date}T23:59:59`);

      if (user_id) {
        query = query.eq("user_id", user_id);
      }
      if (location_id) {
        query = query.eq("location_id", location_id);
      }
      if (department_id) {
        query = query.eq("department_id", department_id);
      }

      const { data: shifts, error: updateError } = await query.select(`
        *,
        user:profiles!shifts_user_id_fkey (id, first_name, last_name, display_name, avatar_url),
        location:locations (id, name),
        department:departments (id, name),
        position:positions (id, name, color)
      `);

      if (updateError) {
        console.error("Error publishing shifts:", updateError);
        return NextResponse.json(
          { error: "Failed to publish shifts" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: shifts || [],
        publishedCount: shifts?.length || 0,
      });
    } else {
      return NextResponse.json(
        { error: "Either shift_ids or start_date/end_date are required" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error in POST /api/shifts/publish:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
