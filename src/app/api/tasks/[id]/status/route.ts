import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface UpdateStatusRequest {
  status: "pending" | "in_progress" | "completed";
}

/**
 * PUT /api/tasks/[id]/status
 * Update task status (assignee or admin/manager)
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

    const { id } = await params;
    const body: UpdateStatusRequest = await request.json();
    const { status } = body;

    if (!status || !["pending", "in_progress", "completed"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be: pending, in_progress, or completed" },
        { status: 400 }
      );
    }

    // Check task exists and belongs to organization
    const { data: existingTask, error: checkError } = await supabase
      .from("tasks")
      .select(`
        id,
        status,
        task_assignments (user_id)
      `)
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (checkError || !existingTask) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    // Check if user is assigned or is a privileged user
    const isAssigned = existingTask.task_assignments?.some(
      (a: { user_id: string }) => a.user_id === user.id
    );

    if (!isAssigned && !isPrivilegedUser(profile.role)) {
      return NextResponse.json(
        { error: "Not authorized to update this task" },
        { status: 403 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    // Set completion info if completing
    if (status === "completed") {
      updateData.completed_at = new Date().toISOString();
      updateData.completed_by = user.id;
    } else if (existingTask.status === "completed") {
      // Clear completion info if un-completing
      updateData.completed_at = null;
      updateData.completed_by = null;
    }

    // Update task
    const { data: task, error: updateError } = await supabase
      .from("tasks")
      .update(updateData)
      .eq("id", id)
      .select(`
        id,
        title,
        status,
        priority,
        due_date,
        completed_at,
        updated_at,
        completed_by_user:profiles!tasks_completed_by_fkey (id, first_name, last_name),
        task_assignments (
          id,
          user:profiles!task_assignments_user_id_fkey (id, first_name, last_name, avatar_url)
        )
      `)
      .single();

    if (updateError) {
      console.error("Error updating task status:", updateError);
      return NextResponse.json(
        { error: "Failed to update task status" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: task });
  } catch (error) {
    console.error("Error in PUT /api/tasks/[id]/status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
