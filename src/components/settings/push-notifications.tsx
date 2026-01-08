"use client";

import { useState } from "react";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Bell, BellOff, Loader2, AlertCircle } from "lucide-react";

interface PushNotificationSettingsProps {
  userId: string;
}

export function PushNotificationSettings({
  userId,
}: PushNotificationSettingsProps) {
  const {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    error,
    subscribe,
    unsubscribe,
  } = usePushNotifications(userId);

  const [switching, setSwitching] = useState(false);

  const handleToggle = async (enabled: boolean) => {
    setSwitching(true);
    try {
      if (enabled) {
        await subscribe();
        toast.success("Push notifications enabled");
      } else {
        await unsubscribe();
        toast.success("Push notifications disabled");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update notification settings"
      );
    } finally {
      setSwitching(false);
    }
  };

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Push notifications are not supported in your browser.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>
              Try using a modern browser like Chrome, Firefox, or Edge to enable
              push notifications.
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Push Notifications
        </CardTitle>
        <CardDescription>
          Receive notifications for important updates even when the app is closed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="push-enabled">Enable push notifications</Label>
            <p className="text-sm text-muted-foreground">
              Get notified about shifts, messages, and approvals
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(isLoading || switching) && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            <Switch
              id="push-enabled"
              checked={isSubscribed}
              onCheckedChange={handleToggle}
              disabled={isLoading || switching}
            />
          </div>
        </div>

        {permission === "denied" && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-destructive">
                Notifications blocked
              </p>
              <p className="text-muted-foreground">
                You&apos;ve blocked notifications for this site. To enable them,
                click the lock icon in your browser&apos;s address bar and allow
                notifications.
              </p>
            </div>
          </div>
        )}

        {error && permission !== "denied" && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <div className="pt-2">
          <p className="text-xs text-muted-foreground">
            Status:{" "}
            {isSubscribed ? (
              <Badge variant="default" className="ml-1">
                Subscribed
              </Badge>
            ) : (
              <Badge variant="secondary" className="ml-1">
                Not subscribed
              </Badge>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
