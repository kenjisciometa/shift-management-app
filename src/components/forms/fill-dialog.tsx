"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type FormTemplate = Database["public"]["Tables"]["form_templates"]["Row"];
type Json = Database["public"]["Tables"]["form_templates"]["Row"]["fields"];

interface FormField {
  id: string;
  type: "text" | "textarea" | "number" | "select" | "checkbox" | "date";
  label: string;
  required: boolean;
  options?: string[];
}

interface FormFillDialogProps {
  profile: Profile;
  template: FormTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FormFillDialog({
  profile,
  template,
  open,
  onOpenChange,
}: FormFillDialogProps) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  const fields = (template?.fields as unknown as FormField[]) || [];

  const handleSubmit = async () => {
    if (!template) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("form_submissions").insert({
        template_id: template.id,
        organization_id: profile.organization_id,
        user_id: profile.id,
        data: formData as Json,
        submitted_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success("Form submitted successfully");
      onOpenChange(false);
      setFormData({});
      router.refresh();
    } catch (error) {
      console.error("Error submitting form:", error);
      toast.error("Failed to submit form");
    } finally {
      setLoading(false);
    }
  };

  const updateField = (fieldId: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
  };

  const renderField = (field: FormField) => {
    switch (field.type) {
      case "text":
        return (
          <Input
            id={field.id}
            value={(formData[field.id] as string) || ""}
            onChange={(e) => updateField(field.id, e.target.value)}
            required={field.required}
          />
        );
      case "textarea":
        return (
          <Textarea
            id={field.id}
            value={(formData[field.id] as string) || ""}
            onChange={(e) => updateField(field.id, e.target.value)}
            required={field.required}
          />
        );
      case "number":
        return (
          <Input
            id={field.id}
            type="number"
            value={(formData[field.id] as string) || ""}
            onChange={(e) => updateField(field.id, e.target.value)}
            required={field.required}
          />
        );
      case "date":
        return (
          <Input
            id={field.id}
            type="date"
            value={(formData[field.id] as string) || ""}
            onChange={(e) => updateField(field.id, e.target.value)}
            required={field.required}
          />
        );
      case "select":
        return (
          <Select
            value={(formData[field.id] as string) || ""}
            onValueChange={(value) => updateField(field.id, value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "checkbox":
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field.id}
              checked={(formData[field.id] as boolean) || false}
              onCheckedChange={(checked) => updateField(field.id, checked)}
            />
            <label htmlFor={field.id} className="text-sm">
              {field.label}
            </label>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template?.name || "Fill Form"}</DialogTitle>
          <DialogDescription>
            {template?.description || "Complete the form below"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {fields.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              This form has no fields configured.
            </p>
          ) : (
            fields.map((field) => (
              <div key={field.id} className="space-y-2">
                {field.type !== "checkbox" && (
                  <Label htmlFor={field.id}>
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                )}
                {renderField(field)}
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || fields.length === 0}>
            {loading ? "Submitting..." : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
