import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";

/**
 * GET /api/forms/submissions/:id
 * Get single form submission
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    let query = supabase
      .from("form_submissions")
      .select(`
        id,
        template_id,
        user_id,
        shift_id,
        data,
        submitted_at,
        created_at,
        updated_at,
        template:form_templates (
          id,
          name,
          description,
          fields
        ),
        user:profiles!form_submissions_user_id_fkey (
          id,
          first_name,
          last_name,
          email
        ),
        shift:shifts (
          id,
          start_time,
          end_time
        )
      `)
      .eq("id", id)
      .eq("organization_id", profile.organization_id);

    // Non-privileged users can only see their own submissions
    if (!isPrivilegedUser(profile.role)) {
      query = query.eq("user_id", user.id);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Form submission not found" },
          { status: 404 }
        );
      }
      console.error("Error fetching form submission:", error);
      return NextResponse.json(
        { error: "Failed to fetch form submission" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data,
    });
  } catch (error) {
    console.error("Error in GET /api/forms/submissions/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
