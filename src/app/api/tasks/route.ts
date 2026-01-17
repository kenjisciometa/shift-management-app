import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";

/**
 * GET /api/tasks
 * Get tasks
 *
 * Query params:
 * - status: 'pending' | 'in_progress' | 'completed' | 'all' (optional, default 'all')
 * - priority: 'low' | 'medium' | 'high' | 'urgent' (optional)
 * - assigned_to: string (user_id, optional)
 * - due_before: YYYY-MM-DD (optional)
 * - due_after: YYYY-MM-DD (optional)
 * - limit: number (optional, default 50)
 * - offset: number (optional, default 0)
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
    const status = searchParams.get("status") || "all";
    const priority = searchParams.get("priority");
    const assignedTo = searchParams.get("assigned_to");
    const dueBefore = searchParams.get("due_before");
    const dueAfter = searchParams.get("due_after");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query
    let query = supabase
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
        completed_at,
        created_by,
        creator:profiles!tasks_created_by_fkey (id, first_name, last_name, avatar_url),
        completed_by_user:profiles!tasks_completed_by_fkey (id, first_name, last_name),
        task_assignments (
          id,
          user_id,
          user:profiles!task_assignments_user_id_fkey (id, first_name, last_name, avatar_url)
        )
      `, { count: "exact" })
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by status
    if (status !== "all") {
      query = query.eq("status", status);
    }

    // Filter by priority
    if (priority) {
      query = query.eq("priority", priority);
    }

    // Filter by due date
    if (dueBefore) {
      query = query.lte("due_date", `${dueBefore}T23:59:59`);
    }
    if (dueAfter) {
      query = query.gte("due_date", `${dueAfter}T00:00:00`);
    }

    const { data: tasks, error: fetchError, count } = await query;

    if (fetchError) {
      console.error("Error fetching tasks:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch tasks" },
        { status: 500 }
      );
    }

    // Filter by assignment if specified
    let filteredTasks = tasks || [];
    if (assignedTo) {
      filteredTasks = filteredTasks.filter((task) =>
        task.task_assignments?.some((a: { user_id: string }) => a.user_id === assignedTo)
      );
    }

    // Non-privileged users can only see tasks assigned to them
    if (!isPrivilegedUser(profile.role)) {
      filteredTasks = filteredTasks.filter((task) =>
        task.task_assignments?.some((a: { user_id: string }) => a.user_id === user.id)
      );
    }

    return NextResponse.json({
      success: true,
      data: filteredTasks,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/tasks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

interface CreateTaskRequest {
  title: string;
  description?: string;
  priority?: string;
  due_date?: string;
  shift_id?: string;
  assigned_to?: string[];
}

/**
 * POST /api/tasks
 * Create a new task (admin/manager only)
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

    const body: CreateTaskRequest = await request.json();
    const { title, description, priority, due_date, shift_id, assigned_to } = body;

    if (!title || title.trim().length === 0) {
      return NextResponse.json(
        { error: "title is required" },
        { status: 400 }
      );
    }

    // Create task
    const { data: task, error: insertError } = await supabase
      .from("tasks")
      .insert({
        organization_id: profile.organization_id,
        title: title.trim(),
        description: description || null,
        priority: priority || "medium",
        due_date: due_date || null,
        shift_id: shift_id || null,
        status: "pending",
        created_by: user.id,
      })
      .select(`
        id,
        title,
        description,
        status,
        priority,
        due_date,
        shift_id,
        created_at,
        creator:profiles!tasks_created_by_fkey (id, first_name, last_name, avatar_url)
      `)
      .single();

    if (insertError) {
      console.error("Error creating task:", insertError);
      return NextResponse.json(
        { error: "Failed to create task" },
        { status: 500 }
      );
    }

    // Assign users if provided
    if (assigned_to && assigned_to.length > 0) {
      const assignments = assigned_to.map((userId) => ({
        task_id: task.id,
        user_id: userId,
        assigned_by: user.id,
      }));

      const { error: assignError } = await supabase
        .from("task_assignments")
        .insert(assignments);

      if (assignError) {
        console.error("Error assigning task:", assignError);
        // Don't fail the request, task was created
      }
    }

    // Fetch the complete task with assignments
    const { data: completeTask } = await supabase
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
        creator:profiles!tasks_created_by_fkey (id, first_name, last_name, avatar_url),
        task_assignments (
          id,
          user:profiles!task_assignments_user_id_fkey (id, first_name, last_name, avatar_url)
        )
      `)
      .eq("id", task.id)
      .single();

    return NextResponse.json({ success: true, data: completeTask || task }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/tasks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
