"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Building2, CheckCircle2 } from "lucide-react";

type Invitation = Database["public"]["Tables"]["employee_invitations"]["Row"] & {
  organizations: {
    id: string;
    name: string;
    logo_url: string | null;
  } | null;
};

interface AcceptInvitationProps {
  invitation: Invitation;
  isLoggedIn: boolean;
}

export function AcceptInvitation({ invitation, isLoggedIn }: AcceptInvitationProps) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"info" | "signup" | "success">(isLoggedIn ? "info" : "signup");

  const [formData, setFormData] = useState({
    email: invitation.email,
    password: "",
    confirmPassword: "",
  });

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      // Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: invitation.email,
        password: formData.password,
        options: {
          data: {
            first_name: invitation.first_name,
            last_name: invitation.last_name,
          },
        },
      });

      if (authError) throw authError;

      if (!authData.user) {
        toast.error("Failed to create account");
        return;
      }

      // Create profile
      const { error: profileError } = await supabase.from("profiles").insert({
        id: authData.user.id,
        organization_id: invitation.organization_id,
        department_id: invitation.department_id,
        first_name: invitation.first_name || "",
        last_name: invitation.last_name || "",
        email: invitation.email,
        role: invitation.role || "employee",
        status: "active",
      });

      if (profileError) {
        console.error("Profile error:", profileError);
        // Profile might be created by trigger, continue anyway
      }

      // Mark invitation as accepted
      const { error: inviteError } = await supabase
        .from("employee_invitations")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
        })
        .eq("id", invitation.id);

      if (inviteError) {
        console.error("Invitation error:", inviteError);
      }

      setStep("success");
      toast.success("Account created successfully!");

      // Redirect after a short delay
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch (error) {
      console.error(error);
      toast.error("Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    setLoading(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Please sign in first");
        return;
      }

      // Update or create profile
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user.id,
        organization_id: invitation.organization_id,
        department_id: invitation.department_id,
        first_name: invitation.first_name || "",
        last_name: invitation.last_name || "",
        email: invitation.email,
        role: invitation.role || "employee",
        status: "active",
      });

      if (profileError) {
        console.error("Profile error:", profileError);
        throw profileError;
      }

      // Mark invitation as accepted
      const { error: inviteError } = await supabase
        .from("employee_invitations")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
        })
        .eq("id", invitation.id);

      if (inviteError) {
        console.error("Invitation error:", inviteError);
      }

      setStep("success");
      toast.success("Invitation accepted!");

      // Redirect after a short delay
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch (error) {
      console.error(error);
      toast.error("Failed to accept invitation");
    } finally {
      setLoading(false);
    }
  };

  if (step === "success") {
    return (
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Welcome!</h2>
          <p className="text-muted-foreground mb-4">
            You have successfully joined {invitation.organizations?.name}.
          </p>
          <p className="text-sm text-muted-foreground">
            Redirecting to dashboard...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-md w-full">
      <CardHeader className="text-center">
        {invitation.organizations?.logo_url ? (
          <img
            src={invitation.organizations.logo_url}
            alt={invitation.organizations.name}
            className="h-16 w-16 mx-auto mb-4 rounded-lg object-contain"
          />
        ) : (
          <div className="h-16 w-16 mx-auto mb-4 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
        )}
        <CardTitle>Join {invitation.organizations?.name}</CardTitle>
        <CardDescription>
          You have been invited to join as {invitation.role}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {step === "info" && isLoggedIn ? (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm">
                <span className="font-medium">Name:</span>{" "}
                {invitation.first_name} {invitation.last_name}
              </p>
              <p className="text-sm">
                <span className="font-medium">Email:</span> {invitation.email}
              </p>
              <p className="text-sm">
                <span className="font-medium">Role:</span>{" "}
                <span className="capitalize">{invitation.role}</span>
              </p>
            </div>

            <Button
              className="w-full"
              onClick={handleAccept}
              disabled={loading}
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Accept Invitation
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="p-4 bg-muted rounded-lg mb-4">
              <p className="text-sm">
                <span className="font-medium">Name:</span>{" "}
                {invitation.first_name} {invitation.last_name}
              </p>
              <p className="text-sm">
                <span className="font-medium">Role:</span>{" "}
                <span className="capitalize">{invitation.role}</span>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Create Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={formData.password}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, password: e.target.value }))
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm password"
                value={formData.confirmPassword}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    confirmPassword: e.target.value,
                  }))
                }
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Account & Join
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Already have an account?{" "}
              <a href="/login" className="text-primary hover:underline">
                Sign in
              </a>
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
