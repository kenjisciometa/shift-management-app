import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface AssignTaskRequest {
  user_ids: string[];
  replace?: boolean; // If true, replace all existing assignments
}

/**
 * POST /api/tasks/[id]/assignments
 * Assign users to a task (admin/manager only)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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
    const body: AssignTaskRequest = await request.json();
    const { user_ids, replace } = body;

    if (!user_ids || user_ids.length === 0) {
      return NextResponse.json(
        { error: "user_ids is required" },
        { status: 400 }
      );
    }

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

    // Verify all users belong to the organization
    const { data: validUsers } = await supabase
      .from("profiles")
      .select("id")
      .eq("organization_id", profile.organization_id)
      .in("id", user_ids);

    if (!validUsers || validUsers.length !== user_ids.length) {
      return NextResponse.json(
        { error: "Invalid user_ids" },
        { status: 400 }
      );
    }

    // If replace mode, delete existing assignments
    if (replace) {
      await supabase
        .from("task_assignments")
        .delete()
        .eq("task_id", id);
    }

    // Get existing assignments to avoid duplicates
    const { data: existingAssignments } = await supabase
      .from("task_assignments")
      .select("user_id")
      .eq("task_id", id);

    const existingUserIds = new Set(existingAssignments?.map((a) => a.user_id) || []);
    const newUserIds = user_ids.filter((userId) => !existingUserIds.has(userId));

    if (newUserIds.length === 0 && !replace) {
      return NextResponse.json(
        { error: "All users are already assigned" },
        { status: 400 }
      );
    }

    // Create new assignments
    if (newUserIds.length > 0 || replace) {
      const assignmentsToInsert = (replace ? user_ids : newUserIds).map((userId) => ({
        task_id: id,
        user_id: userId,
        assigned_by: user.id,
      }));

      const { error: insertError } = await supabase
        .from("task_assignments")
        .insert(assignmentsToInsert);

      if (insertError) {
        console.error("Error assigning task:", insertError);
        return NextResponse.json(
          { error: "Failed to assign task" },
          { status: 500 }
        );
      }
    }

    // Fetch updated task with assignments
    const { data: task } = await supabase
      .from("tasks")
      .select(`
        id,
        title,
        status,
        priority,
        due_date,
        task_assignments (
          id,
          created_at,
          user:profiles!task_assignments_user_id_fkey (id, first_name, last_name, avatar_url)
        )
      `)
      .eq("id", id)
      .single();

    return NextResponse.json({ success: true, data: task });
  } catch (error) {
    console.error("Error in POST /api/tasks/[id]/assignments:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

interface DeleteAssignmentRequest {
  user_id: string;
}

/**
 * DELETE /api/tasks/[id]/assignments
 * Remove a user from a task (admin/manager only)
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
    const body: DeleteAssignmentRequest = await request.json();
    const { user_id } = body;

    if (!user_id) {
      return NextResponse.json(
        { error: "user_id is required" },
        { status: 400 }
      );
    }

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

    // Delete the assignment
    const { error: deleteError } = await supabase
      .from("task_assignments")
      .delete()
      .eq("task_id", id)
      .eq("user_id", user_id);

    if (deleteError) {
      console.error("Error deleting assignment:", deleteError);
      return NextResponse.json(
        { error: "Failed to remove assignment" },
        { status: 500 }
      );
    }

    // Fetch updated task with assignments
    const { data: task } = await supabase
      .from("tasks")
      .select(`
        id,
        title,
        status,
        priority,
        due_date,
        task_assignments (
          id,
          created_at,
          user:profiles!task_assignments_user_id_fkey (id, first_name, last_name, display_name, avatar_url)
        )
      `)
      .eq("id", id)
      .single();

    return NextResponse.json({ success: true, data: task });
  } catch (error) {
    console.error("Error in DELETE /api/tasks/[id]/assignments:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
