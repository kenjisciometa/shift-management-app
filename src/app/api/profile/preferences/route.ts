import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";

interface UserPreferences {
  theme: "light" | "dark" | "system";
  dateFormat: string;
  timezone: string | null;
  calendarView: "day" | "week" | "month";
  showHolidays: boolean;
}

/**
 * GET /api/profile/preferences
 * Get the current user's preferences
 */
export async function GET(request: NextRequest) {
  try {
    const { error: authError, user, supabase } =
      await authenticateAndAuthorize(request);

    if (authError || !user || !supabase) {
      return (
        authError ||
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    const { data: profile, error: fetchError } = await supabase
      .from("profiles")
      .select("preferences")
      .eq("id", user.id)
      .single();

    if (fetchError) {
      console.error("Error fetching preferences:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch preferences" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: profile?.preferences || {},
    });
  } catch (error) {
    console.error("Error in GET /api/profile/preferences:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

interface UpdatePreferencesRequest {
  preferences: Partial<UserPreferences>;
}

/**
 * PUT /api/profile/preferences
 * Update the current user's preferences
 */
export async function PUT(request: NextRequest) {
  try {
    const { error: authError, user, supabase } =
      await authenticateAndAuthorize(request);

    if (authError || !user || !supabase) {
      return (
        authError ||
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    const body: UpdatePreferencesRequest = await request.json();
    const { preferences } = body;

    if (!preferences || typeof preferences !== "object") {
      return NextResponse.json(
        { error: "preferences object is required" },
        { status: 400 }
      );
    }

    // Validate preferences
    const validThemes = ["light", "dark", "system"];
    const validCalendarViews = ["day", "week", "month"];

    if (preferences.theme && !validThemes.includes(preferences.theme)) {
      return NextResponse.json(
        { error: "Invalid theme value" },
        { status: 400 }
      );
    }

    if (preferences.calendarView && !validCalendarViews.includes(preferences.calendarView)) {
      return NextResponse.json(
        { error: "Invalid calendarView value" },
        { status: 400 }
      );
    }

    // Update preferences (merge with existing)
    const { data: updatedProfile, error: updateError } = await supabase
      .from("profiles")
      .update({
        preferences,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select("preferences")
      .single();

    if (updateError) {
      console.error("Error updating preferences:", updateError);
      return NextResponse.json(
        { error: "Failed to update preferences" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedProfile?.preferences,
    });
  } catch (error) {
    console.error("Error in PUT /api/profile/preferences:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
