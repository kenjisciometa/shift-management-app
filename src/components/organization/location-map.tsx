"use client";

import { useState, useMemo } from "react";
import type { Database } from "@/types/database.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin, Globe, Navigation, ExternalLink, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Location = Database["public"]["Tables"]["locations"]["Row"];

interface LocationMapProps {
  locations: Location[];
  onEditLocation?: (location: Location) => void;
  selectedLocationId?: string;
  onSelectLocation?: (locationId: string | null) => void;
}

export function LocationMap({
  locations,
  onEditLocation,
  selectedLocationId,
  onSelectLocation,
}: LocationMapProps) {
  const [mapType, setMapType] = useState<"standard" | "satellite">("standard");

  // Calculate the center point based on all locations
  const mapCenter = useMemo(() => {
    if (locations.length === 0) {
      // Default to Tokyo if no locations
      return { lat: 35.6762, lng: 139.6503 };
    }

    const avgLat =
      locations.reduce((sum, loc) => sum + Number(loc.latitude), 0) /
      locations.length;
    const avgLng =
      locations.reduce((sum, loc) => sum + Number(loc.longitude), 0) /
      locations.length;

    return { lat: avgLat, lng: avgLng };
  }, [locations]);

  // Calculate appropriate zoom level based on spread of locations
  const zoomLevel = useMemo(() => {
    if (locations.length <= 1) return 15;

    const lats = locations.map((loc) => Number(loc.latitude));
    const lngs = locations.map((loc) => Number(loc.longitude));

    const latSpread = Math.max(...lats) - Math.min(...lats);
    const lngSpread = Math.max(...lngs) - Math.min(...lngs);
    const maxSpread = Math.max(latSpread, lngSpread);

    if (maxSpread < 0.01) return 15;
    if (maxSpread < 0.05) return 13;
    if (maxSpread < 0.1) return 12;
    if (maxSpread < 0.5) return 10;
    if (maxSpread < 1) return 9;
    return 8;
  }, [locations]);

  const selectedLocation = locations.find((loc) => loc.id === selectedLocationId);

  // Generate OpenStreetMap URL with markers
  const getMapUrl = () => {
    const centerLat = selectedLocation
      ? Number(selectedLocation.latitude)
      : mapCenter.lat;
    const centerLng = selectedLocation
      ? Number(selectedLocation.longitude)
      : mapCenter.lng;
    const zoom = selectedLocation ? 16 : zoomLevel;

    // Use OpenStreetMap embed
    return `https://www.openstreetmap.org/export/embed.html?bbox=${centerLng - 0.02},${centerLat - 0.015},${centerLng + 0.02},${centerLat + 0.015}&layer=mapnik&marker=${centerLat},${centerLng}`;
  };

  // Generate Google Maps URL for external link
  const getGoogleMapsUrl = (location: Location) => {
    return `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select
            value={selectedLocationId || "all"}
            onValueChange={(value) =>
              onSelectLocation?.(value === "all" ? null : value)
            }
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {locations.map((location) => (
                <SelectItem key={location.id} value={location.id}>
                  {location.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="text-sm text-muted-foreground">
            {locations.length} location{locations.length !== 1 ? "s" : ""} total
          </div>
        </div>
      </div>

      {/* Map and Location List */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Map */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {locations.length > 0 ? (
                <div className="relative">
                  <iframe
                    title="Location Map"
                    width="100%"
                    height="400"
                    style={{ border: 0 }}
                    loading="lazy"
                    allowFullScreen
                    src={getMapUrl()}
                  />
                  {selectedLocation && (
                    <div className="absolute bottom-4 left-4 right-4 bg-background/95 backdrop-blur rounded-lg p-3 shadow-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{selectedLocation.name}</div>
                          {selectedLocation.address && (
                            <div className="text-sm text-muted-foreground">
                              {selectedLocation.address}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            {selectedLocation.geofence_enabled && (
                              <Badge variant="outline" className="text-xs">
                                <Globe className="h-3 w-3 mr-1" />
                                {selectedLocation.radius_meters}m geofence
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <a
                              href={getGoogleMapsUrl(selectedLocation)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4 mr-1" />
                              Google Maps
                            </a>
                          </Button>
                          {onEditLocation && (
                            <Button
                              size="sm"
                              onClick={() => onEditLocation(selectedLocation)}
                            >
                              <Edit2 className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-[400px] flex items-center justify-center bg-muted">
                  <div className="text-center">
                    <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No locations to display</p>
                    <p className="text-sm text-muted-foreground">
                      Add a location to see it on the map
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Location List */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Locations</h3>
          <div className="space-y-2 max-h-[360px] overflow-auto">
            {locations.map((location) => (
              <Card
                key={location.id}
                className={cn(
                  "cursor-pointer transition-colors hover:bg-muted/50",
                  selectedLocationId === location.id && "ring-2 ring-primary"
                )}
                onClick={() =>
                  onSelectLocation?.(
                    selectedLocationId === location.id ? null : location.id
                  )
                }
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                        location.is_active
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{location.name}</span>
                        {!location.is_active && (
                          <Badge variant="secondary" className="text-xs">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      {location.address && (
                        <p className="text-xs text-muted-foreground truncate">
                          {location.address}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Navigation className="h-3 w-3" />
                        <span>
                          {Number(location.latitude).toFixed(4)},{" "}
                          {Number(location.longitude).toFixed(4)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Quick Stats */}
          <Card className="bg-muted/50">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Active</span>
                <span className="font-medium">
                  {locations.filter((l) => l.is_active).length}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Geofence Enabled</span>
                <span className="font-medium">
                  {locations.filter((l) => l.geofence_enabled).length}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Allow Clock Outside</span>
                <span className="font-medium">
                  {locations.filter((l) => l.allow_clock_outside).length}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
