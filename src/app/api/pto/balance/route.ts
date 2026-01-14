import { NextResponse } from "next/server";
import { getAuthData, getCachedSupabase } from "@/lib/auth";

/**
 * GET /api/pto/balance
 * Get PTO balance for the current user or a specific user (admin only)
 */
export async function GET(request: Request) {
  try {
    const authData = await getAuthData();
    if (!authData) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user, profile } = authData;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");
    const year = searchParams.get("year") || new Date().getFullYear().toString();

    // If requesting another user's balance, check if admin
    if (userId && userId !== user.id) {
      const isAdmin = profile.role === "admin" || profile.role === "owner" || profile.role === "manager";
      if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const targetUserId = userId || user.id;
    const supabase = await getCachedSupabase();

    const { data: balances, error } = await supabase
      .from("pto_balances")
      .select(`
        *,
        pto_policies (id, name, pto_type, annual_allowance, max_carryover)
      `)
      .eq("user_id", targetUserId)
      .eq("organization_id", profile.organization_id)
      .eq("year", parseInt(year))
      .order("pto_type", { ascending: true });

    if (error) {
      console.error("Error fetching PTO balance:", error);
      return NextResponse.json({ error: "Failed to fetch PTO balance" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: balances || [] });
  } catch (error) {
    console.error("Error in GET /api/pto/balance:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
