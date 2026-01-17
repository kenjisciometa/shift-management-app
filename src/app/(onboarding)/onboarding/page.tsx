"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiPost, apiGet } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Building2, Users } from "lucide-react";

type Step = "choice" | "create-org" | "join-org";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("choice");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle auth errors from hash fragment (e.g., expired email link)
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash) {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const errorCode = params.get("error_code");
      const errorDescription = params.get("error_description");

      if (errorCode || errorDescription) {
        // Redirect to login with error params
        const loginParams = new URLSearchParams();
        if (errorCode) loginParams.set("error_code", errorCode);
        if (errorDescription) loginParams.set("error_description", errorDescription);
        router.replace(`/login?${loginParams.toString()}`);
      }
    }
  }, [router]);

  // Create organization form
  const [orgName, setOrgName] = useState("");
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );

  // Join organization form
  const [inviteCode, setInviteCode] = useState("");

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await apiPost("/api/onboarding/create-organization", {
        name: orgName,
        timezone: timezone,
      });

      if (!response.success) {
        setError(response.error || "Failed to create organization");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  };

  const handleJoinOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate the invitation first
      const validateResponse = await apiGet(
        `/api/invitations/validate?token=${encodeURIComponent(inviteCode)}`
      );

      if (!validateResponse.success) {
        setError(validateResponse.error || "Invalid or expired invitation code");
        setLoading(false);
        return;
      }

      // Join the organization
      const joinResponse = await apiPost("/api/invitations/join", {
        token: inviteCode,
      });

      if (!joinResponse.success) {
        setError(joinResponse.error || "Failed to join organization");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  };

  if (step === "create-org") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">
              Create your organization
            </CardTitle>
            <CardDescription className="text-center">
              Set up your company to start managing shifts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateOrganization} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">Organization name</Label>
                <Input
                  id="orgName"
                  placeholder="Acme Inc."
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Auto-detected from your browser
                </p>
              </div>

              {error && (
                <div className="text-sm text-destructive text-center">
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep("choice")}
                  disabled={loading}
                >
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? "Creating..." : "Create organization"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "join-org") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">
              Join an organization
            </CardTitle>
            <CardDescription className="text-center">
              Enter the invitation code you received from your employer
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoinOrganization} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="inviteCode">Invitation code</Label>
                <Input
                  id="inviteCode"
                  placeholder="Enter your invitation code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="text-sm text-destructive text-center">
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep("choice")}
                  disabled={loading}
                >
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? "Joining..." : "Join organization"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Welcome to Shift Manager
          </CardTitle>
          <CardDescription className="text-center">
            How would you like to get started?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            className="w-full h-auto py-4 flex flex-col items-center gap-2"
            onClick={() => setStep("create-org")}
          >
            <Building2 className="h-8 w-8" />
            <div className="text-center">
              <div className="font-semibold">Create an organization</div>
              <div className="text-sm text-muted-foreground">
                Set up your company and invite your team
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full h-auto py-4 flex flex-col items-center gap-2"
            onClick={() => setStep("join-org")}
          >
            <Users className="h-8 w-8" />
            <div className="text-center">
              <div className="font-semibold">Join an organization</div>
              <div className="text-sm text-muted-foreground">
                I have an invitation code from my employer
              </div>
            </div>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
