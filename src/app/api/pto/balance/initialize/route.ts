import { NextResponse } from "next/server";
import { getAuthData, getCachedSupabase } from "@/lib/auth";
import type { Database } from "@/types/database.types";

type PTOBalanceInsert = Database["public"]["Tables"]["pto_balances"]["Insert"];

interface InitializeRequest {
  user_ids?: string[];
  year?: number;
  overwrite_existing?: boolean;
}

interface InitializeError {
  user_id: string;
  policy_id: string;
  error: string;
}

interface InitializeResponse {
  created: number;
  skipped: number;
  updated: number;
  errors: InitializeError[];
}

/**
 * POST /api/pto/balance/initialize
 * Initialize PTO balances for users based on active policies (admin only)
 */
export async function POST(request: Request) {
  try {
    const authData = await getAuthData();
    if (!authData) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { profile } = authData;

    // Check if user is admin or owner
    const isAdmin = profile.role === "admin" || profile.role === "owner";
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body: InitializeRequest = await request.json();
    const user_ids = body.user_ids;
    const year = body.year || new Date().getFullYear();
    const overwrite_existing = body.overwrite_existing || false;

    // Validate year is reasonable (current year ± 1)
    const currentYear = new Date().getFullYear();
    if (year < currentYear - 1 || year > currentYear + 1) {
      return NextResponse.json(
        { error: "Year must be within current year ± 1" },
        { status: 400 }
      );
    }

    const supabase = await getCachedSupabase();

    // Fetch active PTO policies for the organization
    const { data: policies, error: policiesError } = await supabase
      .from("pto_policies")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .eq("is_active", true)
      .order("pto_type", { ascending: true });

    if (policiesError) {
      console.error("Error fetching PTO policies:", policiesError);
      return NextResponse.json(
        { error: "Failed to fetch PTO policies" },
        { status: 500 }
      );
    }

    if (!policies || policies.length === 0) {
      return NextResponse.json(
        { error: "No active PTO policies found. Please create policies first." },
        { status: 400 }
      );
    }

    // Fetch target users
    let usersQuery = supabase
      .from("profiles")
      .select("id")
      .eq("organization_id", profile.organization_id)
      .eq("status", "active");

    if (user_ids && user_ids.length > 0) {
      // Validate user_ids belong to the organization
      const { data: validUsers, error: validUsersError } = await supabase
        .from("profiles")
        .select("id")
        .eq("organization_id", profile.organization_id)
        .in("id", user_ids);

      if (validUsersError) {
        console.error("Error validating user_ids:", validUsersError);
        return NextResponse.json(
          { error: "Failed to validate user IDs" },
          { status: 500 }
        );
      }

      const validUserIds = (validUsers || []).map((u) => u.id);
      const invalidUserIds = user_ids.filter((id) => !validUserIds.includes(id));

      if (invalidUserIds.length > 0) {
        return NextResponse.json(
          {
            error: "Some user IDs are invalid or don't belong to your organization",
            invalid_user_ids: invalidUserIds,
          },
          { status: 400 }
        );
      }

      usersQuery = usersQuery.in("id", user_ids);
    }

    const { data: users, error: usersError } = await usersQuery;

    if (usersError) {
      console.error("Error fetching users:", usersError);
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 }
      );
    }

    if (!users || users.length === 0) {
      return NextResponse.json(
        { error: "No active users found" },
        { status: 400 }
      );
    }

    // Check existing balances for all user + pto_type + year combinations
    // We need to check for balances that match user_id, pto_type, and year
    // and optionally policy_id (which may be null)
    const userIds = users.map((u) => u.id);
    const ptoTypes = [...new Set(policies.map((p) => p.pto_type))];

    const { data: existingBalances, error: existingBalancesError } = await supabase
      .from("pto_balances")
      .select("user_id, policy_id, pto_type, id, entitled_days")
      .eq("organization_id", profile.organization_id)
      .eq("year", year)
      .in("user_id", userIds)
      .in("pto_type", ptoTypes);

    if (existingBalancesError) {
      console.error("Error checking existing balances:", existingBalancesError);
      return NextResponse.json(
        { error: "Failed to check existing balances" },
        { status: 500 }
      );
    }

    // Create a map of existing balances for quick lookup
    // Key: user_id:pto_type:policy_id (policy_id can be null)
    const existingBalancesMap = new Map<string, { id: string; entitled_days: number | null }>();
    (existingBalances || []).forEach((balance) => {
      const policyId = balance.policy_id || "null";
      const key = `${balance.user_id}:${balance.pto_type}:${policyId}`;
      existingBalancesMap.set(key, {
        id: balance.id,
        entitled_days: balance.entitled_days,
      });
    });

    // Prepare balances to create/update
    const balancesToInsert: PTOBalanceInsert[] = [];
    const balancesToUpdate: Array<{ id: string; entitled_days: number }> = [];
    const response: InitializeResponse = {
      created: 0,
      skipped: 0,
      updated: 0,
      errors: [],
    };

    // Generate balance records for each user + policy combination
    for (const user of users) {
      for (const policy of policies) {
        // Check if balance exists for this user + pto_type + policy combination
        const key = `${user.id}:${policy.pto_type}:${policy.id}`;
        const existing = existingBalancesMap.get(key);

        if (existing) {
          if (overwrite_existing) {
            // Update existing balance with new entitled_days from policy
            balancesToUpdate.push({
              id: existing.id,
              entitled_days: policy.annual_allowance || 0,
            });
          } else {
            // Skip existing balance (preserve current data)
            response.skipped++;
          }
        } else {
          // Create new balance for this user + policy combination
          balancesToInsert.push({
            organization_id: profile.organization_id,
            user_id: user.id,
            policy_id: policy.id,
            pto_type: policy.pto_type,
            year: year,
            entitled_days: policy.annual_allowance || 0,
            used_days: 0,
            pending_days: 0,
            carryover_days: 0,
            adjustment_days: 0,
          });
        }
      }
    }

    // Insert new balances in batches (Supabase allows up to 1000 rows per insert)
    const BATCH_SIZE = 1000;
    for (let i = 0; i < balancesToInsert.length; i += BATCH_SIZE) {
      const batch = balancesToInsert.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabase
        .from("pto_balances")
        .insert(batch);

      if (insertError) {
        console.error("Error inserting balances:", insertError);
        // Track errors for each balance in the batch
        batch.forEach((balance) => {
          response.errors.push({
            user_id: balance.user_id,
            policy_id: balance.policy_id || "",
            error: insertError.message,
          });
        });
      } else {
        response.created += batch.length;
      }
    }

    // Update existing balances if overwrite is enabled
    if (overwrite_existing && balancesToUpdate.length > 0) {
      for (const balanceUpdate of balancesToUpdate) {
        const { error: updateError } = await supabase
          .from("pto_balances")
          .update({ entitled_days: balanceUpdate.entitled_days })
          .eq("id", balanceUpdate.id);

        if (updateError) {
          console.error("Error updating balance:", updateError);
          // Find the user_id and policy_id for this balance
          const existingBalance = existingBalances?.find(
            (b) => b.id === balanceUpdate.id
          );
          response.errors.push({
            user_id: existingBalance?.user_id || "",
            policy_id: existingBalance?.policy_id || "",
            error: updateError.message,
          });
        } else {
          response.updated++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error in POST /api/pto/balance/initialize:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
