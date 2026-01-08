import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DashboardHeader } from "@/components/dashboard/header";
import { getAuthData } from "@/lib/auth";

export default async function DashboardPage() {
  const authData = await getAuthData();

  if (!authData) {
    redirect("/login");
  }

  const displayName =
    authData.profile.display_name || authData.profile.first_name || authData.user.email;

  return (
    <>
      <DashboardHeader title="Dashboard" />
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <p className="text-muted-foreground">Welcome back, {displayName}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Today&apos;s Shifts</CardTitle>
              <CardDescription>Active shifts for today</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">0</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Clocked In</CardTitle>
              <CardDescription>Employees currently working</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">0</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pending Requests</CardTitle>
              <CardDescription>PTO and shift swap requests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">0</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Unread Messages</CardTitle>
              <CardDescription>New chat messages</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">0</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
