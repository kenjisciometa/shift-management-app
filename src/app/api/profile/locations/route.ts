import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";

/**
 * GET /api/profile/locations
 * Get the current user's assigned locations
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

    // Get user's assigned locations
    const { data: userLocations, error: fetchError } = await supabase
      .from("user_locations")
      .select(`
        id,
        location:locations (
          id,
          name,
          address,
          city,
          state,
          zip_code,
          country,
          phone,
          is_active,
          timezone
        )
      `)
      .eq("user_id", user.id);

    if (fetchError) {
      console.error("Error fetching locations:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch locations" },
        { status: 500 }
      );
    }

    // If user has no specific locations assigned, return all active locations
    if (!userLocations || userLocations.length === 0) {
      const { data: allLocations, error: allError } = await supabase
        .from("locations")
        .select(`
          id,
          name,
          address,
          city,
          state,
          zip_code,
          country,
          phone,
          is_active,
          timezone
        `)
        .eq("organization_id", profile.organization_id)
        .eq("is_active", true)
        .order("name");

      if (allError) {
        console.error("Error fetching all locations:", allError);
        return NextResponse.json(
          { error: "Failed to fetch locations" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: allLocations || [],
        all_locations: true,
      });
    }

    // Extract locations from the join
    const locations = userLocations
      .map((ul) => ul.location)
      .filter((loc) => loc !== null);

    return NextResponse.json({
      success: true,
      data: locations,
      all_locations: false,
    });
  } catch (error) {
    console.error("Error in GET /api/profile/locations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
