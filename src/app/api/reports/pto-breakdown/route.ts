import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";

/**
 * GET /api/reports/pto-breakdown
 * Get PTO usage breakdown (admin/manager only)
 *
 * Query params:
 * - start_date: YYYY-MM-DD (required)
 * - end_date: YYYY-MM-DD (required)
 * - department_id: string (optional)
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
    const departmentId = searchParams.get("department_id");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "start_date and end_date are required" },
        { status: 400 }
      );
    }

    // Get PTO requests
    const { data: requests, error: fetchError } = await supabase
      .from("pto_requests")
      .select(`
        id,
        user_id,
        pto_type,
        status,
        start_date,
        end_date,
        total_days,
        user:profiles!pto_requests_user_id_fkey (
          id,
          first_name,
          last_name,
          display_name,
          department_id,
          department:departments!profiles_department_id_fkey (id, name)
        )
      `)
      .eq("organization_id", profile.organization_id)
      .gte("start_date", startDate)
      .lte("start_date", endDate);

    if (fetchError) {
      console.error("Error fetching PTO requests:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch data" },
        { status: 500 }
      );
    }

    // Filter by department if specified
    let filteredRequests = requests || [];
    if (departmentId) {
      filteredRequests = filteredRequests.filter(
        (r) => r.user?.department_id === departmentId
      );
    }

    // Group by type
    const byType: Record<string, {
      type: string;
      total_requests: number;
      approved: number;
      pending: number;
      rejected: number;
      total_days: number;
    }> = {};

    for (const request of filteredRequests) {
      const type = request.pto_type || "other";
      if (!byType[type]) {
        byType[type] = {
          type,
          total_requests: 0,
          approved: 0,
          pending: 0,
          rejected: 0,
          total_days: 0,
        };
      }

      byType[type].total_requests++;
      if (request.status === "approved") {
        byType[type].approved++;
        byType[type].total_days += request.total_days || 0;
      } else if (request.status === "pending") {
        byType[type].pending++;
      } else if (request.status === "rejected") {
        byType[type].rejected++;
      }
    }

    // Group by department
    const byDepartment: Record<string, {
      department_id: string | null;
      department_name: string;
      total_requests: number;
      approved_days: number;
    }> = {};

    for (const request of filteredRequests) {
      const deptId = request.user?.department_id || "unassigned";
      const deptName = request.user?.department?.name || "Unassigned";

      if (!byDepartment[deptId]) {
        byDepartment[deptId] = {
          department_id: deptId === "unassigned" ? null : deptId,
          department_name: deptName,
          total_requests: 0,
          approved_days: 0,
        };
      }

      byDepartment[deptId].total_requests++;
      if (request.status === "approved") {
        byDepartment[deptId].approved_days += request.total_days || 0;
      }
    }

    // Calculate totals
    const totals = {
      total_requests: filteredRequests.length,
      approved: filteredRequests.filter((r) => r.status === "approved").length,
      pending: filteredRequests.filter((r) => r.status === "pending").length,
      rejected: filteredRequests.filter((r) => r.status === "rejected").length,
      total_approved_days: filteredRequests
        .filter((r) => r.status === "approved")
        .reduce((sum, r) => sum + (r.total_days || 0), 0),
    };

    return NextResponse.json({
      success: true,
      data: {
        period: { start_date: startDate, end_date: endDate },
        by_type: Object.values(byType),
        by_department: Object.values(byDepartment),
        totals,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/reports/pto-breakdown:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
