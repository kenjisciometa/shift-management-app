import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";
import type { Json } from "@/types/database.types";

/**
 * GET /api/forms/submissions
 * Get form submissions
 *
 * Query params:
 * - template_id: string (optional)
 * - user_id: string (optional)
 * - shift_id: string (optional)
 * - start_date: YYYY-MM-DD (optional)
 * - end_date: YYYY-MM-DD (optional)
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
    const templateId = searchParams.get("template_id");
    const userId = searchParams.get("user_id");
    const shiftId = searchParams.get("shift_id");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

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
        template:form_templates (
          id,
          name,
          description
        ),
        user:profiles!form_submissions_user_id_fkey (
          id,
          first_name,
          last_name
        )
      `, { count: "exact" })
      .eq("organization_id", profile.organization_id)
      .order("submitted_at", { ascending: false });

    // Non-privileged users can only see their own submissions
    if (!isPrivilegedUser(profile.role)) {
      query = query.eq("user_id", user.id);
    } else if (userId) {
      query = query.eq("user_id", userId);
    }

    if (templateId) {
      query = query.eq("template_id", templateId);
    }

    if (shiftId) {
      query = query.eq("shift_id", shiftId);
    }

    if (startDate) {
      query = query.gte("submitted_at", `${startDate}T00:00:00`);
    }

    if (endDate) {
      query = query.lte("submitted_at", `${endDate}T23:59:59`);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching form submissions:", error);
      return NextResponse.json(
        { error: "Failed to fetch form submissions" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        submissions: data || [],
        pagination: {
          total: count || 0,
          limit,
          offset,
          hasMore: (count || 0) > offset + limit,
        },
      },
    });
  } catch (error) {
    console.error("Error in GET /api/forms/submissions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/forms/submissions
 * Submit a form
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

    const body = await request.json();
    const { template_id, shift_id, data } = body;

    if (!template_id) {
      return NextResponse.json(
        { error: "Template ID is required" },
        { status: 400 }
      );
    }

    if (!data || typeof data !== "object") {
      return NextResponse.json(
        { error: "Form data is required" },
        { status: 400 }
      );
    }

    // Verify template exists and is active
    const { data: template, error: templateError } = await supabase
      .from("form_templates")
      .select("id, is_active, fields")
      .eq("id", template_id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (templateError || !template) {
      return NextResponse.json(
        { error: "Form template not found" },
        { status: 404 }
      );
    }

    if (!template.is_active) {
      return NextResponse.json(
        { error: "Form template is not active" },
        { status: 400 }
      );
    }

    const { data: submission, error } = await supabase
      .from("form_submissions")
      .insert({
        template_id,
        user_id: user.id,
        shift_id: shift_id || null,
        data: data as Json,
        organization_id: profile.organization_id,
        submitted_at: new Date().toISOString(),
      })
      .select(`
        id,
        template_id,
        user_id,
        shift_id,
        data,
        submitted_at,
        created_at
      `)
      .single();

    if (error) {
      console.error("Error creating form submission:", error);
      return NextResponse.json(
        { error: "Failed to submit form" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: submission,
    }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/forms/submissions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
