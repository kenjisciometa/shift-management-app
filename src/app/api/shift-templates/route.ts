import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";

/**
 * GET /api/shift-templates
 * Get all shift templates for the organization
 *
 * Query params:
 * - is_active: boolean (optional, defaults to true)
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
      .from("shift_templates")
      .select("*", { count: "exact" })
      .eq("organization_id", profile.organization_id)
      .order("name", { ascending: true });

    // Default to active templates only unless explicitly set to false
    if (isActive === null || isActive === "true") {
      query = query.eq("is_active", true);
    } else if (isActive === "false") {
      query = query.eq("is_active", false);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching shift templates:", error);
      return NextResponse.json(
        { error: "Failed to fetch shift templates" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/shift-templates:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

interface CreateShiftTemplateRequest {
  name: string;
  description?: string;
  start_time: string;
  end_time: string;
  break_minutes?: number;
  position?: string;
  color?: string;
  is_active?: boolean;
}

/**
 * POST /api/shift-templates
 * Create a new shift template (admin/manager only)
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

    const body: CreateShiftTemplateRequest = await request.json();
    const {
      name,
      description,
      start_time,
      end_time,
      break_minutes,
      position,
      color,
      is_active,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Template name is required" },
        { status: 400 }
      );
    }

    if (!start_time || !end_time) {
      return NextResponse.json(
        { error: "Start time and end time are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("shift_templates")
      .insert({
        organization_id: profile.organization_id,
        name: name.trim(),
        description: description?.trim() || null,
        start_time,
        end_time,
        break_minutes: break_minutes || 0,
        position: position?.trim() || null,
        color: color || "blue",
        is_active: is_active !== false,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating shift template:", error);
      return NextResponse.json(
        { error: "Failed to create shift template" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/shift-templates:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
