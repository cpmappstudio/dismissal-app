"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { Pencil, Plus } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function BusDialog({
  bus,
  onCreated,
}: {
  bus?: Doc<"buses">;
  onCreated?: (id: Id<"buses">) => void;
}) {
  const t = useTranslations("buses");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          {bus ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {t(bus ? "edit" : "create")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(bus ? "edit" : "create")}</DialogTitle>
          <DialogDescription>{t("formDescription")}</DialogDescription>
        </DialogHeader>
        {open && (
          <BusForm
            bus={bus}
            onSaved={(id) => {
              setOpen(false);
              if (!bus) onCreated?.(id);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function BusForm({
  bus,
  onSaved,
}: {
  bus?: Doc<"buses">;
  onSaved: (id: Id<"buses">) => void;
}) {
  const t = useTranslations("buses");
  const transport = useTranslations("transport");
  const campuses = useQuery(api.campus.getAll, {});
  const save = useMutation(api.buses.save);
  const [name, setName] = useState(bus?.name ?? "");
  const [identifier, setIdentifier] = useState(String(bus?.identifier ?? ""));
  const [campusIds, setCampusIds] = useState(bus?.campusIds ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Capture the version when opening; reactive updates must not silently authorize stale edits.
  const [expectedUpdatedAt] = useState(bus?.updatedAt);
  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        try {
          const id = await save({
            busId: bus?._id,
            identifier,
            name,
            campusIds,
            expectedUpdatedAt,
          });
          onSaved(id);
        } catch (err) {
          setError(err instanceof Error ? err.message : transport("saveError"));
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="bus-name">{t("name")}</Label>
          <Input
            id="bus-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bus-identifier">{transport("identifier")}</Label>
          <Input
            id="bus-identifier"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            readOnly={!!bus}
            required
            maxLength={20}
          />
          {bus && (
            <p className="text-sm text-muted-foreground">
              {t("identifierHint")}
            </p>
          )}
        </div>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">{t("campuses")}</legend>
          {campuses === undefined && (
            <p role="status">{transport("loading")}</p>
          )}
          <div className="max-h-44 space-y-2 overflow-y-auto">
            {campuses
              ?.filter((c) => c.isActive || campusIds.includes(c._id))
              .map((campus) => (
                <label
                  key={campus._id}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={campusIds.includes(campus._id)}
                    onChange={(e) =>
                      setCampusIds(
                        e.target.checked
                          ? [...campusIds, campus._id]
                          : campusIds.filter((id) => id !== campus._id),
                      )
                    }
                  />
                  {campus.campusName}
                </label>
              ))}
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button
          type="submit"
          className="w-full"
          disabled={
            busy || !campusIds.length || !name.trim() || !identifier.trim()
          }
        >
          {transport("save")}
        </Button>
      </fieldset>
    </form>
  );
}
