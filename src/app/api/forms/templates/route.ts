import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";
import type { Json } from "@/types/database.types";

/**
 * GET /api/forms/templates
 * Get all form templates
 *
 * Query params:
 * - is_active: boolean (optional)
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
    const isActive = searchParams.get("is_active");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = supabase
      .from("form_templates")
      .select(`
        id,
        name,
        description,
        fields,
        is_active,
        created_by,
        created_at,
        updated_at,
        creator:profiles!form_templates_created_by_fkey (
          id,
          first_name,
          last_name
        )
      `, { count: "exact" })
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false });

    if (isActive !== null) {
      query = query.eq("is_active", isActive === "true");
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching form templates:", error);
      return NextResponse.json(
        { error: "Failed to fetch form templates" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        templates: data || [],
        pagination: {
          total: count || 0,
          limit,
          offset,
          hasMore: (count || 0) > offset + limit,
        },
      },
    });
  } catch (error) {
    console.error("Error in GET /api/forms/templates:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/forms/templates
 * Create a new form template (admin/manager only)
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

    const body = await request.json();
    const { name, description, fields, is_active } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Template name is required" },
        { status: 400 }
      );
    }

    if (!fields || !Array.isArray(fields)) {
      return NextResponse.json(
        { error: "Fields array is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("form_templates")
      .insert({
        name,
        description: description || null,
        fields: fields as Json,
        is_active: is_active !== false,
        organization_id: profile.organization_id,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating form template:", error);
      return NextResponse.json(
        { error: "Failed to create form template" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data,
    }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/forms/templates:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
