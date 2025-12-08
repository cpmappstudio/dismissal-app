"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, ArrowRight, User, UserCog, Building2 } from "lucide-react";

export default function AdminDashboard() {
  const t = useTranslations();

  return (
    <main className="@container/main space-y-8 lg:px-4 pb-8">
      {/* Welcome Header */}
      <header className="space-y-3 pt-2 px-4 md:px-0">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">
          {t("adminDashboard.welcome.title")}
        </h1>
        <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
          {t("adminDashboard.welcome.subtitle")}
        </p>
      </header>

      {/* Action Cards */}
      <section
        aria-labelledby="actions-heading"
        className="space-y-6 md:space-y-8 px-4 md:px-0"
      >
        <h2
          id="actions-heading"
          className="text-xl md:text-2xl font-semibold mb-3 md:mb-4"
        >
          {t("adminDashboard.management.title")}
        </h2>
        <p className="text-xs md:text-sm text-muted-foreground mb-4 md:mb-6">
          {t("adminDashboard.management.subtitle")}
        </p>
        {/* Manage Students Card */}
        <article className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-3">
          <Card className="flex flex-col md:grid md:grid-cols-3">
            {/* Left column - Icon (2/5) */}
            <CardHeader className="md:col-span-1 flex items-center justify-center py-4 md:py-6">
              <Building2
                className="h-10 w-10 md:h-12 md:w-12 text-yankees-blue"
                aria-hidden="true"
              />
            </CardHeader>

            {/* Right column - Content (3/5) */}
            <CardContent className="md:col-span-2 flex flex-col justify-between px-4 py-3 md:px-3 md:py-2">
              <div className="flex-1 space-y-2">
                <CardTitle className="text-base md:text-lg">
                  {t("adminDashboard.cards.campuses.title")}
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  {t("adminDashboard.cards.campuses.description")}
                </CardDescription>
              </div>
              <CardAction>
                <Button
                  asChild
                  className="w-full group mt-3 md:mt-4 bg-yankees-blue hover:bg-yankees-blue/90 text-white font-semibold shadow-md hover:shadow-lg transition-all text-sm"
                >
                  <Link
                    href="/management/campuses"
                    aria-label={t("adminDashboard.cards.campuses.action")}
                  >
                    <span>{t("adminDashboard.cards.campuses.action")}</span>
                    <ArrowRight
                      className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </Link>
                </Button>
              </CardAction>
            </CardContent>
          </Card>

          <Card className="flex flex-col md:grid md:grid-cols-3">
            {/* Left column - Icon (2/5) */}
            <CardHeader className="md:col-span-1 flex items-center justify-center py-4 md:py-6">
              <Users
                className="h-10 w-10 md:h-12 md:w-12 text-yankees-blue"
                aria-hidden="true"
              />
            </CardHeader>

            {/* Right column - Content (3/5) */}
            <CardContent className="md:col-span-2 flex flex-col justify-between px-4 py-3 md:px-3 md:py-2">
              <div className="flex-1 space-y-2">
                <CardTitle className="text-base md:text-lg">
                  {t("adminDashboard.cards.students.title")}
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  {t("adminDashboard.cards.students.description")}
                </CardDescription>
              </div>
              <CardAction>
                <Button
                  asChild
                  className="w-full group mt-3 md:mt-4 bg-yankees-blue hover:bg-yankees-blue/90 text-white font-semibold shadow-md hover:shadow-lg transition-all text-sm"
                >
                  <Link
                    href="/management/students"
                    aria-label={t("adminDashboard.cards.students.action")}
                  >
                    <span>{t("adminDashboard.cards.students.action")}</span>
                    <ArrowRight
                      className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </Link>
                </Button>
              </CardAction>
            </CardContent>
          </Card>

          {/* Manage Staff Card */}
          <Card className="flex flex-col md:grid md:grid-cols-3">
            {/* Left column - Icon (2/5) */}
            <CardHeader className="md:col-span-1 flex items-center justify-center py-4 md:py-6">
              <User
                className="h-10 w-10 md:h-12 md:w-12 text-yankees-blue"
                aria-hidden="true"
              />
            </CardHeader>

            {/* Right column - Content (3/5) */}
            <CardContent className="md:col-span-2 flex flex-col justify-between px-4 py-3 md:px-3 md:py-2">
              <div className="flex-1 space-y-2">
                <CardTitle className="text-base md:text-lg">
                  {t("adminDashboard.cards.staff.title")}
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  {t("adminDashboard.cards.staff.description")}
                </CardDescription>
              </div>
              <CardAction>
                <Button
                  asChild
                  className="w-full group mt-3 md:mt-4 bg-yankees-blue hover:bg-yankees-blue/90 text-white font-semibold shadow-md hover:shadow-lg transition-all text-sm"
                >
                  <Link
                    href="/management/staff"
                    aria-label={t("adminDashboard.cards.staff.action")}
                  >
                    <span>{t("adminDashboard.cards.staff.action")}</span>
                    <ArrowRight
                      className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </Link>
                </Button>
              </CardAction>
            </CardContent>
          </Card>
        </article>

        {/* Operator Functions Cards */}
        <div>
          <h2 className="text-xl md:text-2xl font-semibold mb-3 md:mb-4">
            {t("adminDashboard.operatorsSection.title")}
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground mb-4 md:mb-6">
            {t("adminDashboard.operatorsSection.subtitle")}
          </p>
        </div>
        <article className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-3">
          {/* Allocator Card */}
          <Card className="flex flex-col md:grid md:grid-cols-3">
            {/* Left column - Icon (2/5) */}
            <CardHeader className="md:col-span-1 flex items-center justify-center py-4 md:py-6">
              <UserCog
                className="h-10 w-10 md:h-12 md:w-12 text-yankees-blue"
                aria-hidden="true"
              />
            </CardHeader>

            {/* Right column - Content (3/5) */}
            <CardContent className="md:col-span-2 flex flex-col justify-between px-4 py-3 md:px-3 md:py-2">
              <div className="flex-1 space-y-2">
                <CardTitle className="text-base md:text-lg">
                  {t("adminDashboard.cards.allocator.title")}
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  {t("adminDashboard.cards.allocator.description")}
                </CardDescription>
              </div>
              <CardAction>
                <Button
                  asChild
                  className="w-full group mt-3 md:mt-4 bg-yankees-blue hover:bg-yankees-blue/90 text-white font-semibold shadow-md hover:shadow-lg transition-all text-sm"
                >
                  <Link
                    href="/operators/allocator"
                    aria-label={t("adminDashboard.cards.allocator.action")}
                  >
                    <span>{t("adminDashboard.cards.allocator.action")}</span>
                    <ArrowRight
                      className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </Link>
                </Button>
              </CardAction>
            </CardContent>
          </Card>

          {/* Dispatcher Card */}
          <Card className="flex flex-col md:grid md:grid-cols-3">
            {/* Left column - Icon (2/5) */}
            <CardHeader className="md:col-span-1 flex items-center justify-center py-4 md:py-6">
              <UserCog
                className="h-10 w-10 md:h-12 md:w-12 text-yankees-blue"
                aria-hidden="true"
              />
            </CardHeader>

            {/* Right column - Content (3/5) */}
            <CardContent className="md:col-span-2 flex flex-col justify-between px-4 py-3 md:px-3 md:py-2">
              <div className="flex-1 space-y-2">
                <CardTitle className="text-base md:text-lg">
                  {t("adminDashboard.cards.dispatcher.title")}
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  {t("adminDashboard.cards.dispatcher.description")}
                </CardDescription>
              </div>
              <CardAction>
                <Button
                  asChild
                  className="w-full group mt-3 md:mt-4 bg-yankees-blue hover:bg-yankees-blue/90 text-white font-semibold shadow-md hover:shadow-lg transition-all text-sm"
                >
                  <Link
                    href="/operators/dispatcher"
                    aria-label={t("adminDashboard.cards.dispatcher.action")}
                  >
                    <span>{t("adminDashboard.cards.dispatcher.action")}</span>
                    <ArrowRight
                      className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </Link>
                </Button>
              </CardAction>
            </CardContent>
          </Card>

          {/* Viewer Card */}
          <Card className="flex flex-col md:grid md:grid-cols-3">
            {/* Left column - Icon (2/5) */}
            <CardHeader className="md:col-span-1 flex items-center justify-center py-4 md:py-6">
              <UserCog
                className="h-10 w-10 md:h-12 md:w-12 text-yankees-blue"
                aria-hidden="true"
              />
            </CardHeader>

            {/* Right column - Content (3/5) */}
            <CardContent className="md:col-span-2 flex flex-col justify-between px-4 py-3 md:px-3 md:py-2">
              <div className="flex-1 space-y-2">
                <CardTitle className="text-base md:text-lg">
                  {t("adminDashboard.cards.viewer.title")}
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  {t("adminDashboard.cards.viewer.description")}
                </CardDescription>
              </div>
              <CardAction>
                <Button
                  asChild
                  className="w-full group mt-3 md:mt-4 bg-yankees-blue hover:bg-yankees-blue/90 text-white font-semibold shadow-md hover:shadow-lg transition-all text-sm"
                >
                  <Link
                    href="/operators/viewer"
                    aria-label={t("adminDashboard.cards.viewer.action")}
                  >
                    <span>{t("adminDashboard.cards.viewer.action")}</span>
                    <ArrowRight
                      className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </Link>
                </Button>
              </CardAction>
            </CardContent>
          </Card>
        </article>
      </section>
    </main>
  );
}
