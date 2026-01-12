import { NextResponse } from "next/server";
import { getAuthData, getCachedSupabase } from "@/lib/auth";

/**
 * PUT /api/pto/requests/[id]/approve
 * Approve a PTO request (admin/manager only)
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authData = await getAuthData();
    if (!authData) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user, profile } = authData;
    const { id } = await params;
    const body = await request.json();
    const reviewComment = body.review_comment || null;

    // Check if user is admin or manager
    const isAdmin = profile.role === "admin" || profile.role === "owner" || profile.role === "manager";
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = await getCachedSupabase();

    // Get the existing request
    const { data: existingRequest, error: fetchError } = await supabase
      .from("pto_requests")
      .select("*")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (fetchError || !existingRequest) {
      return NextResponse.json({ error: "PTO request not found" }, { status: 404 });
    }

    if (existingRequest.status !== "pending") {
      return NextResponse.json(
        { error: "Can only approve pending requests" },
        { status: 400 }
      );
    }

    // Update the request status
    const { data: updatedRequest, error: updateError } = await supabase
      .from("pto_requests")
      .update({
        status: "approved",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_comment: reviewComment,
      })
      .eq("id", id)
      .select(`
        *,
        profiles!pto_requests_user_id_fkey (id, first_name, last_name, display_name, avatar_url),
        profiles!pto_requests_reviewed_by_fkey (id, first_name, last_name, display_name)
      `)
      .single();

    if (updateError) {
      console.error("Error approving PTO request:", updateError);
      return NextResponse.json({ error: "Failed to approve PTO request" }, { status: 500 });
    }

    // Update PTO balance
    const currentYear = new Date().getFullYear();
    const { data: balance } = await supabase
      .from("pto_balances")
      .select("*")
      .eq("user_id", existingRequest.user_id)
      .eq("organization_id", profile.organization_id)
      .eq("pto_type", existingRequest.pto_type)
      .eq("year", currentYear)
      .single();

    if (balance) {
      // Move from pending to used
      await supabase
        .from("pto_balances")
        .update({
          used_days: (balance.used_days || 0) + existingRequest.total_days,
          pending_days: Math.max(0, (balance.pending_days || 0) - existingRequest.total_days),
        })
        .eq("id", balance.id);
    } else {
      // Create balance record if it doesn't exist
      await supabase.from("pto_balances").insert({
        organization_id: profile.organization_id,
        user_id: existingRequest.user_id,
        pto_type: existingRequest.pto_type,
        year: currentYear,
        used_days: existingRequest.total_days,
        pending_days: 0,
        entitled_days: 0,
      });
    }

    // TODO: Create notification for the user
    // await createNotification(...)

    return NextResponse.json({ success: true, data: updatedRequest });
  } catch (error) {
    console.error("Error in PUT /api/pto/requests/[id]/approve:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
