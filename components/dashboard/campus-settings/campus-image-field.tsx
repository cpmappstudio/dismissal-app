"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { ImageIcon, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import {
  Attachment,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentActions,
  AttachmentAction,
  AttachmentTrigger,
} from "@/components/ui/attachment";
import { CAMPUS_IMAGE_TYPES, campusImageError } from "@/lib/campus-image";

export function CampusImageField({
  file,
  existingUrl,
  disabled,
  onChange,
}: {
  file: File | null;
  existingUrl?: string | null;
  disabled: boolean;
  onChange: (file: File | null) => void;
}) {
  const t = useTranslations("campusImage");
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const src = file ? preview : existingUrl;
  const hasImage = Boolean(file || existingUrl);
  const action = hasImage ? t("replace") : t("upload");
  return (
    <div className="mt-4 min-w-0 space-y-2">
      <Label htmlFor={id}>{t("label")}</Label>
      <Attachment
        className="w-full min-w-0 flex-nowrap"
        state={
          error
            ? "error"
            : disabled && file
              ? "uploading"
              : hasImage
                ? "done"
                : "idle"
        }
        aria-busy={disabled && Boolean(file)}
      >
        <AttachmentMedia variant="image" className="aspect-video w-24">
          {src ? (
            <Image
              src={src}
              alt={t("preview")}
              fill
              sizes="96px"
              className="object-cover"
              unoptimized={Boolean(file)}
            />
          ) : (
            <ImageIcon aria-hidden />
          )}
        </AttachmentMedia>
        <AttachmentContent className="overflow-hidden">
          <AttachmentTitle title={file?.name}>
            {disabled && file
              ? t("saving")
              : file?.name || (hasImage ? t("current") : t("upload"))}
          </AttachmentTitle>
          <AttachmentDescription className="whitespace-normal">
            {t("hint")}
          </AttachmentDescription>
        </AttachmentContent>
        <AttachmentTrigger
          id={id}
          disabled={disabled}
          aria-label={action}
          aria-describedby={id + "-help"}
          onClick={() => input.current?.click()}
        />
        <AttachmentActions>
          <AttachmentAction
            type="button"
            disabled={disabled}
            aria-label={action}
            onClick={() => input.current?.click()}
          >
            <Upload />
          </AttachmentAction>
          {hasImage && (
            <AttachmentAction
              type="button"
              disabled={disabled}
              aria-label={t("remove")}
              onClick={() => {
                setError(null);
                onChange(null);
              }}
            >
              <X />
            </AttachmentAction>
          )}
        </AttachmentActions>
      </Attachment>
      <input
        ref={input}
        type="file"
        accept={CAMPUS_IMAGE_TYPES.join(",")}
        className="hidden"
        disabled={disabled}
        aria-label={t("label")}
        onChange={(event) => {
          const selected = event.target.files?.[0];
          event.target.value = "";
          if (!selected) return;
          const invalid = campusImageError({
            contentType: selected.type,
            size: selected.size,
          });
          setError(invalid ? t(invalid) : null);
          if (!invalid) onChange(selected);
        }}
      />
      <p
        id={id + "-help"}
        className={
          error ? "text-sm text-destructive" : "text-xs text-muted-foreground"
        }
        role={error ? "alert" : undefined}
      >
        {error || t("fallback")}
      </p>
    </div>
  );
}
