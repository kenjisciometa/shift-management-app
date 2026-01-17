import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";

interface BulkStatusUpdateRequest {
  entry_ids: string[];
  status: "pending" | "approved" | "rejected";
}

/**
 * PUT /api/time-entries/bulk-status
 * Bulk update status for multiple time entries
 */
export async function PUT(request: NextRequest) {
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

    const body: BulkStatusUpdateRequest = await request.json();

    if (!body.entry_ids || body.entry_ids.length === 0) {
      return NextResponse.json(
        { error: "entry_ids is required and cannot be empty" },
        { status: 400 }
      );
    }

    if (!body.status) {
      return NextResponse.json(
        { error: "status is required" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      status: body.status,
      updated_at: new Date().toISOString(),
    };

    if (body.status === "approved") {
      updateData.approved_at = new Date().toISOString();
      updateData.approved_by = user.id;
    } else {
      updateData.approved_at = null;
      updateData.approved_by = null;
    }

    const { error: updateError } = await supabase
      .from("time_entries")
      .update(updateData)
      .in("id", body.entry_ids)
      .eq("organization_id", profile.organization_id);

    if (updateError) {
      console.error("Error bulk updating time entries:", updateError);
      return NextResponse.json(
        { error: "Failed to update time entries" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in PUT /api/time-entries/bulk-status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
