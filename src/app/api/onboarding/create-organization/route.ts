import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface CreateOrganizationRequest {
  name: string;
  timezone: string;
}

/**
 * POST /api/onboarding/create-organization
 * Create a new organization with the current user as owner
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: CreateOrganizationRequest = await request.json();

    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { error: "Organization name is required" },
        { status: 400 }
      );
    }

    // Generate a slug from the organization name
    const slug = body.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // Use the database function to create organization and profile together
    const { error: createError } = await supabase.rpc(
      "create_organization_with_owner",
      {
        p_name: body.name.trim(),
        p_slug: `${slug}-${Date.now().toString(36)}`,
        p_timezone: body.timezone || "UTC",
        p_user_id: user.id,
        p_email: user.email!,
        p_first_name: user.user_metadata?.first_name || "Admin",
        p_last_name: user.user_metadata?.last_name || "User",
      }
    );

    if (createError) {
      console.error("Error creating organization:", createError);
      return NextResponse.json(
        { error: createError.message || "Failed to create organization" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/onboarding/create-organization:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
