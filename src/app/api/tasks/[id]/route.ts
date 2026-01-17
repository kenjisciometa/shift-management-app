import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/tasks/[id]
 * Get a specific task
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

    const { id } = await params;

    const { data: task, error: fetchError } = await supabase
      .from("tasks")
      .select(`
        id,
        title,
        description,
        status,
        priority,
        due_date,
        shift_id,
        created_at,
        updated_at,
        completed_at,
        creator:profiles!tasks_created_by_fkey (id, first_name, last_name, avatar_url),
        completed_by_user:profiles!tasks_completed_by_fkey (id, first_name, last_name),
        task_assignments (
          id,
          user_id,
          created_at,
          assigned_by_user:profiles!task_assignments_assigned_by_fkey (id, first_name, last_name),
          user:profiles!task_assignments_user_id_fkey (id, first_name, last_name, avatar_url)
        ),
        shift:shifts (id, start_time, end_time)
      `)
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Task not found" },
          { status: 404 }
        );
      }
      console.error("Error fetching task:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch task" },
        { status: 500 }
      );
    }

    // Non-privileged users can only see tasks assigned to them
    if (!isPrivilegedUser(profile.role)) {
      const isAssigned = task.task_assignments?.some(
        (a: { user_id: string }) => a.user_id === user.id
      );
      if (!isAssigned) {
        return NextResponse.json(
          { error: "Task not found" },
          { status: 404 }
        );
      }
    }

    return NextResponse.json({ success: true, data: task });
  } catch (error) {
    console.error("Error in GET /api/tasks/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

interface UpdateTaskRequest {
  title?: string;
  description?: string | null;
  priority?: string;
  due_date?: string | null;
  shift_id?: string | null;
}

/**
 * PUT /api/tasks/[id]
 * Update a task (admin/manager only)
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

    if (!isPrivilegedUser(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body: UpdateTaskRequest = await request.json();

    // Check task exists and belongs to organization
    const { data: existingTask, error: checkError } = await supabase
      .from("tasks")
      .select("id")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (checkError || !existingTask) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.due_date !== undefined) updateData.due_date = body.due_date;
    if (body.shift_id !== undefined) updateData.shift_id = body.shift_id;

    // Update task
    const { data: task, error: updateError } = await supabase
      .from("tasks")
      .update(updateData)
      .eq("id", id)
      .select(`
        id,
        title,
        description,
        status,
        priority,
        due_date,
        shift_id,
        created_at,
        updated_at,
        creator:profiles!tasks_created_by_fkey (id, first_name, last_name, avatar_url),
        task_assignments (
          id,
          user:profiles!task_assignments_user_id_fkey (id, first_name, last_name, avatar_url)
        )
      `)
      .single();

    if (updateError) {
      console.error("Error updating task:", updateError);
      return NextResponse.json(
        { error: "Failed to update task" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: task });
  } catch (error) {
    console.error("Error in PUT /api/tasks/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tasks/[id]
 * Delete a task (admin/manager only)
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

    if (!isPrivilegedUser(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Check task exists and belongs to organization
    const { data: existingTask, error: checkError } = await supabase
      .from("tasks")
      .select("id")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (checkError || !existingTask) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    // Delete task assignments first
    await supabase
      .from("task_assignments")
      .delete()
      .eq("task_id", id);

    // Delete task
    const { error: deleteError } = await supabase
      .from("tasks")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting task:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete task" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/tasks/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
