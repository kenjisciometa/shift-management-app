"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type Location = Database["public"]["Tables"]["locations"]["Row"];

interface LocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: Location | null;
  organizationId: string;
}

export function LocationDialog({
  open,
  onOpenChange,
  location,
  organizationId,
}: LocationDialogProps) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    address: "",
    latitude: "",
    longitude: "",
    radiusMeters: "100",
    geofenceEnabled: true,
    allowClockOutside: false,
    isActive: true,
  });

  useEffect(() => {
    if (location) {
      setFormData({
        name: location.name,
        address: location.address || "",
        latitude: String(location.latitude),
        longitude: String(location.longitude),
        radiusMeters: String(location.radius_meters || 100),
        geofenceEnabled: location.geofence_enabled ?? true,
        allowClockOutside: location.allow_clock_outside ?? false,
        isActive: location.is_active ?? true,
      });
    } else {
      setFormData({
        name: "",
        address: "",
        latitude: "",
        longitude: "",
        radiusMeters: "100",
        geofenceEnabled: true,
        allowClockOutside: false,
        isActive: true,
      });
    }
  }, [location, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Location name is required");
      return;
    }

    if (!formData.latitude || !formData.longitude) {
      toast.error("Latitude and longitude are required");
      return;
    }

    setLoading(true);

    try {
      const data = {
        organization_id: organizationId,
        name: formData.name.trim(),
        address: formData.address.trim() || null,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        radius_meters: parseInt(formData.radiusMeters),
        geofence_enabled: formData.geofenceEnabled,
        allow_clock_outside: formData.allowClockOutside,
        is_active: formData.isActive,
      };

      if (location) {
        const { error } = await supabase
          .from("locations")
          .update(data)
          .eq("id", location.id);

        if (error) throw error;
        toast.success("Location updated");
      } else {
        const { error } = await supabase.from("locations").insert(data);

        if (error) throw error;
        toast.success("Location created");
      }

      onOpenChange(false);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(location ? "Failed to update location" : "Failed to create location");
    } finally {
      setLoading(false);
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData((prev) => ({
          ...prev,
          latitude: String(position.coords.latitude),
          longitude: String(position.coords.longitude),
        }));
        toast.success("Location detected");
      },
      (error) => {
        toast.error("Failed to get current location");
        console.error(error);
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {location ? "Edit Location" : "Add Location"}
          </DialogTitle>
          <DialogDescription>
            {location
              ? "Update location details and geofencing settings."
              : "Add a new work location with geofencing."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Location Name</Label>
            <Input
              id="name"
              placeholder="Main Office"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address (optional)</Label>
            <Input
              id="address"
              placeholder="123 Main St, City, Country"
              value={formData.address}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, address: e.target.value }))
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                type="number"
                step="any"
                placeholder="35.6762"
                value={formData.latitude}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, latitude: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                placeholder="139.6503"
                value={formData.longitude}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, longitude: e.target.value }))
                }
                required
              />
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGetCurrentLocation}
          >
            Use Current Location
          </Button>

          <div className="space-y-2">
            <Label htmlFor="radius">Geofence Radius (meters)</Label>
            <Input
              id="radius"
              type="number"
              min="10"
              max="10000"
              value={formData.radiusMeters}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, radiusMeters: e.target.value }))
              }
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="geofence">Enable Geofencing</Label>
                <p className="text-xs text-muted-foreground">
                  Require employees to be within radius to clock in
                </p>
              </div>
              <Switch
                id="geofence"
                checked={formData.geofenceEnabled}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, geofenceEnabled: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="allowOutside">Allow Clock Outside</Label>
                <p className="text-xs text-muted-foreground">
                  Allow clocking in/out outside geofence (with warning)
                </p>
              </div>
              <Switch
                id="allowOutside"
                checked={formData.allowClockOutside}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, allowClockOutside: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="isActive">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive locations cannot be used for shifts
                </p>
              </div>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, isActive: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {location ? "Save Changes" : "Add Location"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
