import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";

/**
 * GET /api/timesheets/entries-data
 * Get time entries and shifts data for the timesheets view
 * Query params:
 * - start_date: YYYY-MM-DD
 * - end_date: YYYY-MM-DD
 * - employee_id: optional user ID filter
 * - location_id: optional location filter
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

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const employeeId = searchParams.get("employee_id");
    const locationId = searchParams.get("location_id");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "start_date and end_date are required" },
        { status: 400 }
      );
    }

    const isAdmin = isPrivilegedUser(profile.role);
    const canViewAllTimesheets = isAdmin;

    // Build query for time entries
    let timeEntriesQuery = supabase
      .from("time_entries")
      .select(`
        id,
        user_id,
        timestamp,
        entry_type,
        location_id,
        is_manual,
        notes,
        status,
        profiles!time_entries_user_id_fkey (
          id,
          first_name,
          last_name,
          display_name,
          employee_code
        ),
        locations (
          id,
          name
        )
      `)
      .eq("organization_id", profile.organization_id)
      .gte("timestamp", `${startDate}T00:00:00`)
      .lte("timestamp", `${endDate}T23:59:59`);

    // Apply role-based filtering
    if (!canViewAllTimesheets) {
      timeEntriesQuery = timeEntriesQuery.eq("user_id", profile.id);
    } else if (employeeId && employeeId !== "all") {
      timeEntriesQuery = timeEntriesQuery.eq("user_id", employeeId);
    }

    // Apply location filter
    if (locationId && locationId !== "all") {
      timeEntriesQuery = timeEntriesQuery.eq("location_id", locationId);
    }

    const { data: timeEntries, error: timeEntriesError } = await timeEntriesQuery;

    if (timeEntriesError) {
      console.error("Error fetching time entries:", timeEntriesError);
      return NextResponse.json(
        { error: "Failed to fetch time entries" },
        { status: 500 }
      );
    }

    // Build query for shifts
    let shiftsQuery = supabase
      .from("shifts")
      .select(`
        id,
        user_id,
        start_time,
        end_time,
        break_minutes,
        location_id,
        position_id,
        profiles!shifts_user_id_fkey (
          id,
          first_name,
          last_name,
          display_name,
          employee_code
        ),
        locations (
          id,
          name
        ),
        positions (
          id,
          name
        )
      `)
      .eq("organization_id", profile.organization_id)
      .gte("start_time", `${startDate}T00:00:00`)
      .lte("start_time", `${endDate}T23:59:59`);

    // Apply role-based filtering
    if (!canViewAllTimesheets) {
      shiftsQuery = shiftsQuery.eq("user_id", profile.id);
    } else if (employeeId && employeeId !== "all") {
      shiftsQuery = shiftsQuery.eq("user_id", employeeId);
    }

    const { data: shifts, error: shiftsError } = await shiftsQuery;

    if (shiftsError) {
      console.error("Error fetching shifts:", shiftsError);
      return NextResponse.json(
        { error: "Failed to fetch shifts" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        timeEntries: timeEntries || [],
        shifts: shifts || [],
      },
    });
  } catch (error) {
    console.error("Error in GET /api/timesheets/entries-data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
