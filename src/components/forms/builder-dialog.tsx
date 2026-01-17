"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiPost, apiPut, apiDelete } from "@/lib/api-client";
import type { Database, Json } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

type FormTemplate = Database["public"]["Tables"]["form_templates"]["Row"];

interface FormField {
  id: string;
  type: "text" | "textarea" | "number" | "email" | "select" | "checkbox" | "date";
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[]; // For select type
}

interface FormBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: FormTemplate | null;
  organizationId: string;
}

const fieldTypes = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Multi-line Text" },
  { value: "number", label: "Number" },
  { value: "email", label: "Email" },
  { value: "select", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
  { value: "date", label: "Date" },
];

export function FormBuilderDialog({
  open,
  onOpenChange,
  template,
  organizationId,
}: FormBuilderDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isEditing = !!template;

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [fields, setFields] = useState<FormField[]>([]);

  useEffect(() => {
    if (open) {
      if (template) {
        setFormName(template.name);
        setFormDescription(template.description || "");
        setFields((template.fields as unknown as FormField[]) || []);
      } else {
        setFormName("");
        setFormDescription("");
        setFields([]);
      }
    }
  }, [open, template]);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const addField = () => {
    setFields([
      ...fields,
      {
        id: generateId(),
        type: "text",
        label: "",
        placeholder: "",
        required: false,
        options: [],
      },
    ]);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(
      fields.map((field) => (field.id === id ? { ...field, ...updates } : field))
    );
  };

  const removeField = (id: string) => {
    setFields(fields.filter((field) => field.id !== id));
  };

  const moveField = (id: string, direction: "up" | "down") => {
    const index = fields.findIndex((f) => f.id === id);
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === fields.length - 1)
    ) {
      return;
    }
    const newFields = [...fields];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    [newFields[index], newFields[swapIndex]] = [
      newFields[swapIndex],
      newFields[index],
    ];
    setFields(newFields);
  };

  const handleSubmit = async () => {
    if (!formName.trim()) {
      toast.error("Please enter a form name");
      return;
    }

    if (fields.length === 0) {
      toast.error("Please add at least one field");
      return;
    }

    // Validate all fields have labels
    const invalidField = fields.find((f) => !f.label.trim());
    if (invalidField) {
      toast.error("All fields must have a label");
      return;
    }

    setLoading(true);

    try {
      const templateData = {
        name: formName.trim(),
        description: formDescription.trim() || null,
        fields: fields as unknown as Json,
        is_active: true,
      };

      if (isEditing && template) {
        const response = await apiPut(`/api/forms/templates/${template.id}`, templateData);
        if (!response.success) {
          throw new Error(response.error || "Failed to update template");
        }
        toast.success("Form template updated");
      } else {
        const response = await apiPost("/api/forms/templates", templateData);
        if (!response.success) {
          throw new Error(response.error || "Failed to create template");
        }
        toast.success("Form template created");
      }

      onOpenChange(false);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(isEditing ? "Failed to update template" : "Failed to create template");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!template) return;
    if (!confirm("Are you sure you want to delete this form template?")) return;

    setDeleting(true);

    try {
      const response = await apiDelete(`/api/forms/templates/${template.id}`);

      if (!response.success) {
        throw new Error(response.error || "Failed to delete template");
      }

      toast.success("Form template deleted");
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete template");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Form Template" : "Create Form Template"}
          </DialogTitle>
          <DialogDescription>
            Build your form by adding fields below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Form Name */}
          <div className="space-y-2">
            <Label htmlFor="formName">Form Name</Label>
            <Input
              id="formName"
              placeholder="e.g., Daily Checklist"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
          </div>

          {/* Form Description */}
          <div className="space-y-2">
            <Label htmlFor="formDescription">Description (optional)</Label>
            <Textarea
              id="formDescription"
              placeholder="Describe what this form is for..."
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Fields */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Form Fields</Label>
              <Button type="button" variant="outline" size="sm" onClick={addField}>
                <Plus className="h-4 w-4 mr-2" />
                Add Field
              </Button>
            </div>

            {fields.length === 0 ? (
              <div className="border rounded-lg p-6 text-center text-muted-foreground">
                No fields yet. Click &quot;Add Field&quot; to get started.
              </div>
            ) : (
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="border rounded-lg p-4 space-y-3 bg-muted/30"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          Field {index + 1}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => moveField(field.id, "up")}
                          disabled={index === 0}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => moveField(field.id, "down")}
                          disabled={index === fields.length - 1}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeField(field.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Field Type</Label>
                        <Select
                          value={field.type}
                          onValueChange={(value) =>
                            updateField(field.id, {
                              type: value as FormField["type"],
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {fieldTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Label</Label>
                        <Input
                          placeholder="Field label"
                          value={field.label}
                          onChange={(e) =>
                            updateField(field.id, { label: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Placeholder (optional)</Label>
                      <Input
                        placeholder="Placeholder text"
                        value={field.placeholder || ""}
                        onChange={(e) =>
                          updateField(field.id, { placeholder: e.target.value })
                        }
                      />
                    </div>

                    {field.type === "select" && (
                      <div className="space-y-2">
                        <Label>Options (comma-separated)</Label>
                        <Input
                          placeholder="Option 1, Option 2, Option 3"
                          value={(field.options || []).join(", ")}
                          onChange={(e) =>
                            updateField(field.id, {
                              options: e.target.value
                                .split(",")
                                .map((o) => o.trim())
                                .filter((o) => o),
                            })
                          }
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Switch
                        id={`required-${field.id}`}
                        checked={field.required}
                        onCheckedChange={(checked) =>
                          updateField(field.id, { required: checked })
                        }
                      />
                      <Label htmlFor={`required-${field.id}`}>Required</Label>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          {isEditing && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={loading || deleting}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading || deleting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || deleting}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {isEditing ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
