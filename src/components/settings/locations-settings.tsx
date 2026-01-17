"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiDelete } from "@/lib/api-client";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  MapPin,
  Loader2,
  Plus,
  MoreHorizontal,
  Globe,
  Map,
  List,
} from "lucide-react";
import { LocationDialog } from "@/components/organization/location-dialog";
import { LocationMap } from "@/components/organization/location-map";

type Location = Database["public"]["Tables"]["locations"]["Row"];

interface LocationsSettingsProps {
  locations: Location[];
  organizationId: string;
}

export function LocationsSettings({
  locations,
  organizationId,
}: LocationsSettingsProps) {
  const router = useRouter();
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Dialogs
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

  // Location view mode
  const [locationViewMode, setLocationViewMode] = useState<"list" | "map">("list");
  const [selectedMapLocationId, setSelectedMapLocationId] = useState<string | null>(null);

  const handleDeleteLocation = async (locationId: string) => {
    setProcessingId(locationId);
    try {
      const response = await apiDelete(`/api/organization/locations/${locationId}`);

      if (!response.success) {
        throw new Error(response.error || "Failed to delete location");
      }

      toast.success("Location deleted");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete location");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Locations</h2>
          <p className="text-sm text-muted-foreground">
            Manage work locations and geofencing settings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-lg p-1">
            <Button
              variant={locationViewMode === "list" ? "default" : "ghost"}
              size="sm"
              className="h-8"
              onClick={() => setLocationViewMode("list")}
            >
              <List className="h-4 w-4 mr-1" />
              List
            </Button>
            <Button
              variant={locationViewMode === "map" ? "default" : "ghost"}
              size="sm"
              className="h-8"
              onClick={() => setLocationViewMode("map")}
            >
              <Map className="h-4 w-4 mr-1" />
              Map
            </Button>
          </div>
          <Button
            onClick={() => {
              setSelectedLocation(null);
              setLocationDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Location
          </Button>
        </div>
      </div>

      {locationViewMode === "map" ? (
        <LocationMap
          locations={locations}
          selectedLocationId={selectedMapLocationId || undefined}
          onSelectLocation={(id) => setSelectedMapLocationId(id)}
          onEditLocation={(location) => {
            setSelectedLocation(location);
            setLocationDialogOpen(true);
          }}
        />
      ) : locations.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[150px]">Name</TableHead>
                <TableHead className="min-w-[200px]">Address</TableHead>
                <TableHead className="min-w-[100px]">Status</TableHead>
                <TableHead className="min-w-[100px]">Geofence</TableHead>
                <TableHead className="min-w-[100px]">Radius</TableHead>
                <TableHead className="min-w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.map((location) => (
                <TableRow key={location.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      {location.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground">
                      {location.address || "-"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={location.is_active ? "outline" : "secondary"} className={location.is_active ? "bg-green-50 text-green-700 border-green-200" : ""}>
                      {location.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {location.geofence_enabled ? (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        <Globe className="h-3 w-3 mr-1" />
                        Enabled
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">Disabled</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {location.geofence_enabled ? (
                      <span>{location.radius_meters}m</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={processingId === location.id}
                        >
                          {processingId === location.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MoreHorizontal className="h-4 w-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedLocation(location);
                            setLocationDialogOpen(true);
                          }}
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDeleteLocation(location.id)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No locations configured</p>
            <Button
              variant="link"
              onClick={() => {
                setSelectedLocation(null);
                setLocationDialogOpen(true);
              }}
            >
              Add your first location
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Location Dialog */}
      <LocationDialog
        open={locationDialogOpen}
        onOpenChange={setLocationDialogOpen}
        location={selectedLocation}
        organizationId={organizationId}
      />
    </div>
  );
}
