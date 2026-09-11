"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useConvexAuth, usePaginatedQuery } from "convex/react";
import { Search } from "lucide-react";
import { api } from "@/convex/_generated/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BusDialog } from "@/components/dashboard/buses/bus-dialog";
import { BusHero } from "@/components/dashboard/buses/bus-hero";

export default function BusesPage() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("buses");
  const transport = useTranslations("transport");
  const [search, setSearch] = useState("");
  const { isAuthenticated } = useConvexAuth();
  const { results, status, loadMore } = usePaginatedQuery(
    api.buses.list,
    isAuthenticated ? {} : "skip",
    { initialNumItems: 30 },
  );
  const query = search.trim().toLocaleLowerCase();
  const buses = results.filter((bus) =>
    `${bus.name} ${bus.identifier}`.toLocaleLowerCase().includes(query),
  );
  return (
    <div className="flex-1 space-y-6 pb-8">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label={t("search")}
            placeholder={t("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 bg-card pl-10"
          />
        </div>
        <BusDialog
          onCreated={(id) => router.push(`/${locale}/operators/buses/${id}`)}
        />
      </div>
      {status === "LoadingFirstPage" ? (
        <p role="status">{transport("loading")}</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {buses.map((bus) => (
            <Link key={bus._id} href={`/${locale}/operators/buses/${bus._id}`}>
              <Card className="group relative cursor-pointer overflow-hidden border-border/60 bg-card pt-0 shadow-sm transition-all duration-200 hover:shadow-md">
                <BusHero />
                <CardHeader className="gap-1 px-5">
                  <CardTitle className="text-lg font-semibold">
                    {bus.name}
                  </CardTitle>
                  <CardDescription>
                    {transport("bus")} · {bus.identifier}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
      {!buses.length && status !== "LoadingFirstPage" && (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {t(status === "Exhausted" ? "empty" : "moreResults")}
        </p>
      )}
      {status !== "Exhausted" && status !== "LoadingFirstPage" && (
        <Button
          variant="outline"
          disabled={status === "LoadingMore"}
          onClick={() => loadMore(30)}
        >
          {transport("loadMore")}
        </Button>
      )}
    </div>
  );
}
