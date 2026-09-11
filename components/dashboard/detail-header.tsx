import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DetailHeader({
  title,
  backHref,
  backLabel,
  action,
}: {
  title: string;
  backHref: string;
  backLabel: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <div className="flex flex-wrap items-center gap-3 pt-1 md:pt-0">
        <Button variant="outline" className="gap-2" asChild>
          <Link href={backHref}>
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
        </Button>
        {action}
      </div>
    </div>
  );
}
