import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/team/members/[id]/locations
 * Get locations assigned to a team member
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

    // Verify member belongs to organization
    const { data: member, error: checkError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (checkError || !member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("user_locations")
      .select(`
        id,
        is_primary,
        location:locations (id, name, address)
      `)
      .eq("user_id", id);

    if (error) {
      console.error("Error fetching user locations:", error);
      return NextResponse.json(
        { error: "Failed to fetch locations" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    console.error("Error in GET /api/team/members/[id]/locations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

interface AssignLocationRequest {
  location_id: string;
  is_primary?: boolean;
}

/**
 * POST /api/team/members/[id]/locations
 * Assign a location to a team member
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
    const body: AssignLocationRequest = await request.json();

    if (!body.location_id) {
      return NextResponse.json(
        { error: "location_id is required" },
        { status: 400 }
      );
    }

    // Verify member belongs to organization
    const { data: member, error: memberError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (memberError || !member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Verify location belongs to organization
    const { data: location, error: locationError } = await supabase
      .from("locations")
      .select("id")
      .eq("id", body.location_id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (locationError || !location) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      );
    }

    // Check if assignment already exists
    const { data: existing } = await supabase
      .from("user_locations")
      .select("id")
      .eq("user_id", id)
      .eq("location_id", body.location_id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Location already assigned to this member" },
        { status: 400 }
      );
    }

    // Create assignment
    const { data, error } = await supabase
      .from("user_locations")
      .insert({
        user_id: id,
        location_id: body.location_id,
        is_primary: body.is_primary || false,
      })
      .select(`
        id,
        is_primary,
        location:locations (id, name, address)
      `)
      .single();

    if (error) {
      console.error("Error assigning location:", error);
      return NextResponse.json(
        { error: "Failed to assign location" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, data },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/team/members/[id]/locations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/team/members/[id]/locations
 * Remove a location from a team member
 * Query param: location_id
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
    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get("location_id");

    if (!locationId) {
      return NextResponse.json(
        { error: "location_id query parameter is required" },
        { status: 400 }
      );
    }

    // Verify member belongs to organization
    const { data: member, error: memberError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (memberError || !member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    const { error } = await supabase
      .from("user_locations")
      .delete()
      .eq("user_id", id)
      .eq("location_id", locationId);

    if (error) {
      console.error("Error removing location:", error);
      return NextResponse.json(
        { error: "Failed to remove location" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/team/members/[id]/locations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

interface BulkUpdateLocationsRequest {
  location_ids: string[];
}

/**
 * PUT /api/team/members/[id]/locations
 * Bulk update locations for a team member (replaces all existing)
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
    const body: BulkUpdateLocationsRequest = await request.json();

    // Verify member belongs to organization
    const { data: member, error: memberError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (memberError || !member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Delete all existing locations
    const { error: deleteError } = await supabase
      .from("user_locations")
      .delete()
      .eq("user_id", id);

    if (deleteError) {
      console.error("Error deleting locations:", deleteError);
      return NextResponse.json(
        { error: "Failed to update locations" },
        { status: 500 }
      );
    }

    // Insert new locations
    if (body.location_ids && body.location_ids.length > 0) {
      const { error: insertError } = await supabase
        .from("user_locations")
        .insert(
          body.location_ids.map((locationId, index) => ({
            user_id: id,
            location_id: locationId,
            is_primary: index === 0,
          }))
        );

      if (insertError) {
        console.error("Error inserting locations:", insertError);
        return NextResponse.json(
          { error: "Failed to update locations" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in PUT /api/team/members/[id]/locations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
