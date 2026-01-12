"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function signInWithPassword(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.session) {
    return { error: "Failed to create session" };
  }

  // Check if user has a profile with an organization
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", data.user.id)
    .single();

  // If no profile or no organization, redirect to onboarding
  if (!profile?.organization_id) {
    redirect("/onboarding");
  }

  // Redirect to dashboard
  redirect("/dashboard");
}
