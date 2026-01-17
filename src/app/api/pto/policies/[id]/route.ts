import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import type { Database } from "@/types/database.types";

type PTOPolicyUpdate = Database["public"]["Tables"]["pto_policies"]["Update"];

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/pto/policies/[id]
 * Get a specific PTO policy
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

    const { data: policy, error: fetchError } = await supabase
      .from("pto_policies")
      .select("*")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return NextResponse.json(
          { error: "PTO policy not found" },
          { status: 404 }
        );
      }
      console.error("Error fetching PTO policy:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch PTO policy" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: policy });
  } catch (error) {
    console.error("Error in GET /api/pto/policies/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/pto/policies/[id]
 * Update a specific PTO policy (admin only)
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

    // Check if user is admin
    const isAdmin = profile.role === "admin" || profile.role === "owner";
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body: PTOPolicyUpdate = await request.json();

    // Remove fields that shouldn't be updated directly
    const { organization_id: _, id: __, ...updateData } = body as PTOPolicyUpdate & { id?: string };

    const { data: policy, error: updateError } = await supabase
      .from("pto_policies")
      .update(updateData)
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === "PGRST116") {
        return NextResponse.json(
          { error: "PTO policy not found" },
          { status: 404 }
        );
      }
      console.error("Error updating PTO policy:", updateError);
      return NextResponse.json(
        { error: "Failed to update PTO policy" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: policy });
  } catch (error) {
    console.error("Error in PUT /api/pto/policies/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/pto/policies/[id]
 * Delete a specific PTO policy (admin only)
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

    // Check if user is admin
    const isAdmin = profile.role === "admin" || profile.role === "owner";
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Check if policy exists
    const { data: existingPolicy, error: checkError } = await supabase
      .from("pto_policies")
      .select("id")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (checkError || !existingPolicy) {
      return NextResponse.json(
        { error: "PTO policy not found" },
        { status: 404 }
      );
    }

    // Delete the policy
    const { error: deleteError } = await supabase
      .from("pto_policies")
      .delete()
      .eq("id", id)
      .eq("organization_id", profile.organization_id);

    if (deleteError) {
      console.error("Error deleting PTO policy:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete PTO policy" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "PTO policy deleted successfully",
    });
  } catch (error) {
    console.error("Error in DELETE /api/pto/policies/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
