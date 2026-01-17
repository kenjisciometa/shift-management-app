import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isAdminUser } from "@/app/api/shared/rbac";
import type { Json } from "@/types/database.types";

/**
 * GET /api/organization
 * Get organization information (admin only)
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

    if (!isAdminUser(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: organization, error: fetchError } = await supabase
      .from("organizations")
      .select(`
        id,
        name,
        slug,
        logo_url,
        timezone,
        locale,
        settings,
        created_at,
        updated_at
      `)
      .eq("id", profile.organization_id)
      .single();

    if (fetchError) {
      console.error("Error fetching organization:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch organization" },
        { status: 500 }
      );
    }

    // Get counts
    const [
      { count: memberCount },
      { count: locationCount },
      { count: departmentCount },
      { count: positionCount },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", profile.organization_id)
        .eq("status", "active"),
      supabase
        .from("locations")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", profile.organization_id)
        .eq("is_active", true),
      supabase
        .from("departments")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", profile.organization_id)
        .eq("is_active", true),
      supabase
        .from("positions")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", profile.organization_id)
        .eq("is_active", true),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        ...organization,
        stats: {
          members: memberCount || 0,
          locations: locationCount || 0,
          departments: departmentCount || 0,
          positions: positionCount || 0,
        },
      },
    });
  } catch (error) {
    console.error("Error in GET /api/organization:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

interface UpdateOrganizationRequest {
  name?: string;
  logo_url?: string | null;
  timezone?: string;
  locale?: string;
  settings?: Record<string, unknown>;
}

/**
 * PUT /api/organization
 * Update organization information (admin only)
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

    if (!isAdminUser(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body: UpdateOrganizationRequest = await request.json();

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.logo_url !== undefined) updateData.logo_url = body.logo_url;
    if (body.timezone !== undefined) updateData.timezone = body.timezone;
    if (body.locale !== undefined) updateData.locale = body.locale;

    // Merge settings if provided
    if (body.settings !== undefined) {
      const { data: currentOrg } = await supabase
        .from("organizations")
        .select("settings")
        .eq("id", profile.organization_id)
        .single();

      const currentSettings = (currentOrg?.settings as Record<string, unknown>) || {};
      updateData.settings = {
        ...currentSettings,
        ...body.settings,
      } as Json;
    }

    const { data: organization, error: updateError } = await supabase
      .from("organizations")
      .update(updateData)
      .eq("id", profile.organization_id)
      .select(`
        id,
        name,
        slug,
        logo_url,
        timezone,
        locale,
        settings,
        updated_at
      `)
      .single();

    if (updateError) {
      console.error("Error updating organization:", updateError);
      return NextResponse.json(
        { error: "Failed to update organization" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: organization });
  } catch (error) {
    console.error("Error in PUT /api/organization:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
