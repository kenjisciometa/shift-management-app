import { NextResponse } from "next/server";
import { getAuthData, getCachedSupabase } from "@/lib/auth";
import type { Database } from "@/types/database.types";

type PTOPolicyUpdate = Database["public"]["Tables"]["pto_policies"]["Update"];

/**
 * GET /api/pto/policies
 * Get PTO policies for the organization
 */
export async function GET(request: Request) {
  try {
    const authData = await getAuthData();
    if (!authData) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { profile } = authData;
    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get("is_active");

    const supabase = await getCachedSupabase();

    let query = supabase
      .from("pto_policies")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .order("pto_type", { ascending: true });

    if (isActive !== null) {
      query = query.eq("is_active", isActive === "true");
    }

    const { data: policies, error } = await query;

    if (error) {
      console.error("Error fetching PTO policies:", error);
      return NextResponse.json({ error: "Failed to fetch PTO policies" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: policies || [] });
  } catch (error) {
    console.error("Error in GET /api/pto/policies:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/pto/policies
 * Update PTO policies (admin only)
 */
export async function PUT(request: Request) {
  try {
    const authData = await getAuthData();
    if (!authData) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { profile } = authData;

    // Check if user is admin
    const isAdmin = profile.role === "admin" || profile.role === "owner";
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { policies } = body;

    if (!Array.isArray(policies)) {
      return NextResponse.json({ error: "Policies must be an array" }, { status: 400 });
    }

    const supabase = await getCachedSupabase();

    // Update each policy
    const updatePromises = policies.map((policy: PTOPolicyUpdate & { id: string }) => {
      const { id, ...updateData } = policy;
      return supabase
        .from("pto_policies")
        .update(updateData)
        .eq("id", id)
        .eq("organization_id", profile.organization_id)
        .select()
        .single();
    });

    const results = await Promise.all(updatePromises);
    const errors = results.filter((result) => result.error);

    if (errors.length > 0) {
      console.error("Error updating PTO policies:", errors);
      return NextResponse.json(
        { error: "Failed to update some policies", details: errors },
        { status: 500 }
      );
    }

    const updatedPolicies = results.map((result) => result.data).filter(Boolean);

    return NextResponse.json({ success: true, data: updatedPolicies });
  } catch (error) {
    console.error("Error in PUT /api/pto/policies:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
