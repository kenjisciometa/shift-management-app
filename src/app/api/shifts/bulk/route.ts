import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import type { Database } from "@/types/database.types";

type ShiftInsert = Database["public"]["Tables"]["shifts"]["Insert"];

interface BulkPublishRequest {
  action: "publish";
  shift_ids: string[];
}

interface BulkCopyRequest {
  action: "copy";
  shift_ids: string[];
  target_dates: string[]; // ISO date strings
}

interface BulkDeleteRequest {
  action: "delete";
  shift_ids: string[];
}

type BulkRequest = BulkPublishRequest | BulkCopyRequest | BulkDeleteRequest;

/**
 * POST /api/shifts/bulk
 * Perform bulk operations on shifts (publish, copy, delete)
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

    // Check if user is admin or manager
    const isAdminOrManager =
      profile.role === "admin" ||
      profile.role === "owner" ||
      profile.role === "manager";
    if (!isAdminOrManager) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body: BulkRequest = await request.json();
    const organizationId = profile.organization_id;

    if (!body.action || !body.shift_ids || body.shift_ids.length === 0) {
      return NextResponse.json(
        { error: "action and shift_ids are required" },
        { status: 400 }
      );
    }

    // Verify all shifts belong to the organization
    const { data: existingShifts, error: verifyError } = await supabase
      .from("shifts")
      .select("id, user_id, location_id, department_id, start_time, end_time, position_id, notes, color")
      .eq("organization_id", organizationId)
      .in("id", body.shift_ids);

    if (verifyError) {
      console.error("Error verifying shifts:", verifyError);
      return NextResponse.json(
        { error: "Failed to verify shifts" },
        { status: 500 }
      );
    }

    if (!existingShifts || existingShifts.length !== body.shift_ids.length) {
      return NextResponse.json(
        { error: "Some shifts not found or not accessible" },
        { status: 404 }
      );
    }

    switch (body.action) {
      case "publish": {
        const { error: updateError } = await supabase
          .from("shifts")
          .update({ is_published: true })
          .eq("organization_id", organizationId)
          .in("id", body.shift_ids);

        if (updateError) {
          console.error("Error publishing shifts:", updateError);
          return NextResponse.json(
            { error: "Failed to publish shifts" },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          data: {
            published: body.shift_ids.length,
          },
          message: `${body.shift_ids.length} shift(s) published`,
        });
      }

      case "copy": {
        const copyRequest = body as BulkCopyRequest;
        if (!copyRequest.target_dates || copyRequest.target_dates.length === 0) {
          return NextResponse.json(
            { error: "target_dates are required for copy action" },
            { status: 400 }
          );
        }

        // Parse target dates
        const targetDates = copyRequest.target_dates.map((d) => new Date(d));
        const invalidDates = targetDates.some((d) => isNaN(d.getTime()));
        if (invalidDates) {
          return NextResponse.json(
            { error: "Invalid date format in target_dates" },
            { status: 400 }
          );
        }

        // Create new shifts for each target date
        const newShifts: ShiftInsert[] = [];

        for (const targetDate of targetDates) {
          for (const shift of existingShifts) {
            const originalStart = new Date(shift.start_time);
            const originalEnd = new Date(shift.end_time);

            // Calculate new start and end times preserving the time of day
            const newStart = new Date(targetDate);
            newStart.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0);

            const newEnd = new Date(targetDate);
            newEnd.setHours(originalEnd.getHours(), originalEnd.getMinutes(), 0, 0);

            // Handle overnight shifts
            if (newEnd <= newStart) {
              newEnd.setDate(newEnd.getDate() + 1);
            }

            newShifts.push({
              organization_id: organizationId,
              user_id: shift.user_id,
              location_id: shift.location_id,
              department_id: shift.department_id,
              start_time: newStart.toISOString(),
              end_time: newEnd.toISOString(),
              position_id: shift.position_id,
              notes: shift.notes,
              color: shift.color,
              is_published: false, // Copied shifts are drafts by default
            });
          }
        }

        const { data: createdShifts, error: insertError } = await supabase
          .from("shifts")
          .insert(newShifts)
          .select("id");

        if (insertError) {
          console.error("Error copying shifts:", insertError);
          return NextResponse.json(
            { error: "Failed to copy shifts" },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          data: {
            created: createdShifts?.length || 0,
            source_shifts: existingShifts.length,
            target_dates: targetDates.length,
          },
          message: `Copied ${existingShifts.length} shift(s) to ${targetDates.length} date(s)`,
        });
      }

      case "delete": {
        const { error: deleteError } = await supabase
          .from("shifts")
          .delete()
          .eq("organization_id", organizationId)
          .in("id", body.shift_ids);

        if (deleteError) {
          console.error("Error deleting shifts:", deleteError);
          return NextResponse.json(
            { error: "Failed to delete shifts" },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          data: {
            deleted: body.shift_ids.length,
          },
          message: `${body.shift_ids.length} shift(s) deleted`,
        });
      }

      default:
        return NextResponse.json(
          { error: "Invalid action. Must be 'publish', 'copy', or 'delete'" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error in POST /api/shifts/bulk:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
