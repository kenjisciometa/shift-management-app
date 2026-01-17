import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";

/**
 * GET /api/reports/summary
 * Get summary metrics for reporting (admin/manager only)
 *
 * Query params:
 * - start_date: YYYY-MM-DD (required)
 * - end_date: YYYY-MM-DD (required)
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

    if (!isPrivilegedUser(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "start_date and end_date are required" },
        { status: 400 }
      );
    }

    // Get various counts and metrics
    const [
      shiftsResult,
      timeEntriesResult,
      ptoResult,
      swapResult,
      memberResult,
    ] = await Promise.all([
      // Total shifts
      supabase
        .from("shifts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", profile.organization_id)
        .gte("start_time", `${startDate}T00:00:00`)
        .lte("start_time", `${endDate}T23:59:59`),

      // Time entries
      supabase
        .from("time_entries")
        .select("id, entry_type", { count: "exact" })
        .eq("organization_id", profile.organization_id)
        .gte("timestamp", `${startDate}T00:00:00`)
        .lte("timestamp", `${endDate}T23:59:59`),

      // PTO requests
      supabase
        .from("pto_requests")
        .select("id, status", { count: "exact" })
        .eq("organization_id", profile.organization_id)
        .gte("start_date", startDate)
        .lte("start_date", endDate),

      // Shift swaps
      supabase
        .from("shift_swaps")
        .select("id, status", { count: "exact" })
        .eq("organization_id", profile.organization_id)
        .gte("created_at", `${startDate}T00:00:00`)
        .lte("created_at", `${endDate}T23:59:59`),

      // Active members
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", profile.organization_id)
        .eq("status", "active"),
    ]);

    // Calculate metrics
    const clockInCount = timeEntriesResult.data?.filter(
      (e) => e.entry_type === "clock_in"
    ).length || 0;

    const ptoByStatus = {
      pending: ptoResult.data?.filter((r) => r.status === "pending").length || 0,
      approved: ptoResult.data?.filter((r) => r.status === "approved").length || 0,
      rejected: ptoResult.data?.filter((r) => r.status === "rejected").length || 0,
    };

    const swapByStatus = {
      pending: swapResult.data?.filter((s) => s.status === "pending").length || 0,
      approved: swapResult.data?.filter((s) => s.status === "approved").length || 0,
      rejected: swapResult.data?.filter((s) => s.status === "rejected").length || 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        period: { start_date: startDate, end_date: endDate },
        metrics: {
          total_shifts: shiftsResult.count || 0,
          total_clock_ins: clockInCount,
          total_time_entries: timeEntriesResult.count || 0,
          active_employees: memberResult.count || 0,
          pto_requests: {
            total: ptoResult.count || 0,
            ...ptoByStatus,
          },
          shift_swaps: {
            total: swapResult.count || 0,
            ...swapByStatus,
          },
        },
      },
    });
  } catch (error) {
    console.error("Error in GET /api/reports/summary:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
