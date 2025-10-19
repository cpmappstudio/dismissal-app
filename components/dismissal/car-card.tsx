"use client";

import * as React from "react";
import { Trash2, Users, GraduationCap, Cake } from "lucide-react";
import { StudentAvatar } from "@/components/dashboard/students-table/student-avatar";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Car } from "./car";
import { BirthdayDecoration } from "./birthday-decoration";
import { useTranslations } from "next-intl";
import { CarData } from "./types";
import { LANE_COLORS } from "./constants";
import { formatTime } from "./utils";

// Internal component to handle student display logic
interface StudentInfoProps {
  students: CarData["students"];
  t: (key: string) => string;
}

const StudentInfo = React.memo<StudentInfoProps>(({ students, t }) => {
  const firstStudent = students[0];
  const isSingleStudent = students.length === 1;

  // Common styling for text (left aligned under avatars/badge)
  const textClassName =
    "text-white font-bold drop-shadow-lg leading-none break-words hyphens-auto text-left";
  const textStyle = {
    fontSize: "clamp(0.75rem, 2.5vw, 1.25rem)",
    lineHeight: "clamp(0.9rem, 3vw, 1.4rem)",
  };

  // Extract last name for siblings display
  const getLastName = (fullName: string) => {
    const parts = fullName.trim().split(" ");
    return parts.length > 1 ? parts[parts.length - 1] : parts[0];
  };

  return (
    <div className={textClassName} style={textStyle}>
      <div className="flex flex-col items-start">
        {isSingleStudent ? (
          <>
            <span className="pb-1 text-sm md:text-base xl:text-lg 4xl:text-2xl">
              {firstStudent.name}
            </span>
            <span className="text-yellow-200 text-xs md:text-sm xl:text-base 4xl:text-lg font-semibold">
              ({firstStudent.grade || `${t("car.grade")} 5`})
            </span>
          </>
        ) : (
          <>
            <span className="pb-1 text-sm md:text-base xl:text-lg 4xl:text-2xl">
              {`Siblings ${getLastName(firstStudent.name)}`}
            </span>
            <span className="text-yellow-200 text-xs md:text-sm xl:text-base 4xl:text-lg font-semibold">
              (
              {students
                .map((student) => student.grade || `${t("car.grade")} 5`)
                .join(", ")}
              )
            </span>
          </>
        )}
      </div>
    </div>
  );
});

StudentInfo.displayName = "StudentInfo";

interface CarCardProps {
  car: CarData;
  onRemove?: (carId: string) => void;
  showRemoveButton?: boolean;
  lane: "left" | "right";
  isViewerMode?: boolean;
  hasBirthdayToday?: boolean;
}

export const CarCard = React.memo<CarCardProps>(
  
  ({
    car,
    onRemove,
    showRemoveButton = false,
    lane,
    isViewerMode = false,
    hasBirthdayToday = false,
  }) => {
    const t = useTranslations("dismissal");

    // Helper function to check if a student has birthday today
    const checkStudentBirthday = React.useCallback(
      (student: CarData["students"][0]) => {
        if (!student.birthday) return false;

        const today = new Date();
        const utcMinus5 = new Date(today.getTime() - 5 * 60 * 60 * 1000);
        const todayFormatted = `${String(utcMinus5.getMonth() + 1).padStart(2, "0")}/${String(utcMinus5.getDate()).padStart(2, "0")}/${utcMinus5.getFullYear()}`;

        if (student.birthday.includes("/")) {
          const [month, day] = student.birthday.split("/");
          const birthdayThisYear = `${month.padStart(2, "0")}/${day.padStart(2, "0")}/${utcMinus5.getFullYear()}`;
          return birthdayThisYear === todayFormatted;
        }
        return false;
      },
      [],
    );

    // Helper function to get display name for multiple students
    // const getDisplayName = React.useMemo(() => {
    //     if (car.students.length === 1) {
    //         return car.students[0].name
    //     }
    //     if (car.students.length === 2) {
    //         return `${car.students[0].name} y ${car.students[1].name}`
    //     }
    //     return `${car.students[0].name} +${car.students.length - 1} más`
    // }, [car.students])

    // Get lane colors from constants
    const laneColors = LANE_COLORS[lane];

    return (
      <div
        className={`relative z-30 ${isViewerMode ? "flex flex-col items-center justify-center max-md:mx-2 md:mx-4 lg:mx-6 xl:mx-8 max-md:mt-0 md:mt-2 lg:mt-0" : "flex justify-center"}`}
      >
        <Drawer>
          <DrawerTrigger asChild>
            {isViewerMode ? (
              /* Viewer Mode Layout - Redesigned for large screens */
              <div
                className={`relative cursor-pointer hover:scale-105 transition-transform duration-200 group z-30 flex flex-col items-center}`}
              >
                {/* Birthday Decoration */}
                {hasBirthdayToday && (
                  <BirthdayDecoration isViewer={true} intensity="normal" />
                )}

                <div
                  className={`info ${laneColors.badge} flex flex-col rounded-2xl py-2 px-3 w-full mb-1}`}
                >
                  {/* Top row: Avatars (left) and Car Number Badge (right) */}
                  <div className="flex justify-between items-start w-full mb-1">
                    {/* Left side - Avatars */}
                    <div className="flex-shrink-0">
                      {car.students.length === 1 ? (
                        // Single student - show one avatar
                        <div className="relative">
                          <StudentAvatar
                            avatarStorageId={car.students[0].avatarStorageId}
                            fallbackUrl={car.students[0].imageUrl}
                            firstName={car.students[0].name.split(" ")[0] || ""}
                            lastName={
                              car.students[0].name
                                .split(" ")
                                .slice(1)
                                .join(" ") || car.students[0].name
                            }
                            size="sm"
                            className={`w-7 h-7 md:w-9 md:h-9 xl:w-11 xl:h-11 ${laneColors.background} border-2 border-white shadow-lg`}
                          />
                          {checkStudentBirthday(car.students[0]) && (
                            <div className="absolute -top-1 -right-1 bg-yellow-500 text-white rounded-full p-1">
                              <Cake className="h-2 w-2" />
                            </div>
                          )}
                        </div>
                      ) : (
                        // Multiple students - show overlapping avatars
                        <div className="relative">
                          <div className="flex -space-x-1">
                            {car.students.slice(0, 3).map((student, index) => (
                              <div
                                key={student.id}
                                style={{ zIndex: 30 - index }}
                              >
                                <StudentAvatar
                                  avatarStorageId={student.avatarStorageId}
                                  fallbackUrl={student.imageUrl}
                                  firstName={student.name.split(" ")[0] || ""}
                                  lastName={
                                    student.name
                                      .split(" ")
                                      .slice(1)
                                      .join(" ") || student.name
                                  }
                                  size="sm"
                                  className={`w-7 h-7 md:w-9 md:h-9 xl:w-11 xl:h-11 ${laneColors.background} border-2 border-white shadow-lg`}
                                />
                                {checkStudentBirthday(student) && (
                                  <div
                                    className="absolute -top-1 -right-1 bg-yellow-500 text-white rounded-full p-1"
                                    style={{ zIndex: 40 }}
                                  >
                                    <Cake className="h-2 w-2" />
                                  </div>
                                )}
                              </div>
                            ))}
                            {car.students.length > 3 && (
                              <div
                                className={`w-7 h-7 md:w-9 md:h-9 lg:w-11 lg:h-11 border-2 border-white shadow-lg text-xs flex items-center justify-center font-bold bg-gray-600 text-white rounded-full`}
                                style={{ zIndex: 30 - 3 }}
                              >
                                +{car.students.length - 3}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right side - Car Number Badge */}
                    <div className="text-white font-bold items-center rounded-full z-50 flex px-2 py-1 md:px-2.5 md:py-1">
                      {showRemoveButton && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemove?.(car.id);
                          }}
                          className="p-1 hover:text-red-500 rounded-l-full transition-colors duration-200"
                        ></button>
                      )}
                      <span
                        className={`${showRemoveButton ? "rounded-r-full" : "rounded-full"}`}
                        style={{ fontSize: "clamp(0.875rem, 2.2vw, 1.125rem)" }}
                      >
                        {car.carNumber}
                      </span>
                    </div>
                  </div>

                  {/* Bottom row: Student Names - Centered */}
                  <div className="w-full px-1 flex justify-start">
                    <StudentInfo students={car.students} t={t} />
                  </div>
                </div>

                {/* SVG Car - CENTER - Optimized size - Closer to text */}
                <Car
                  size="viewer"
                  color={hasBirthdayToday ? "#D4AF37" : "#A6A6A6"}
                  className="!filter max-md:!-mt-2 md:!-mt-8"
                  isViewer={isViewerMode}
                />
              </div>
            ) : (
              /* Non-Viewer Mode Layout - Original */
              <div
                className={`relative cursor-pointer hover:scale-105 transition-transform duration-200 group z-30}`}
              >
                {/* Birthday Decoration */}
                {hasBirthdayToday && (
                  <BirthdayDecoration isViewer={false} intensity="normal" />
                )}

                {/* SVG Car with dynamic color */}
                <Car
                  size="lg"
                  // color={car.imageColor}
                  color={hasBirthdayToday ? "#F59E0B" : "#A6A6A6"}
                  className="filter drop-shadow-lg hover:drop-shadow-xl transition-all duration-200"
                  isViewer={isViewerMode}
                />

                {/* Combined Car Number Badge and Remove Button */}
                <div
                  className={`absolute -top-2 -right-2 ${laneColors.badge} text-white text-sm font-bold rounded-full shadow-lg z-50 flex items-center`}
                >
                  {showRemoveButton && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove?.(car.id);
                      }}
                      className="p-1.5 hover:text-red-500 rounded-l-full transition-colors duration-200"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  <span
                    className={`px-2 text-xl py-1 ${showRemoveButton ? "rounded-r-full" : "rounded-full px-3"}`}
                  >
                    {car.carNumber}
                  </span>
                </div>
              </div>
            )}
          </DrawerTrigger>

          <DrawerContent>
            <div className="mx-auto w-full max-w-md">
              <DrawerHeader>
                <DrawerTitle
                  className={`text-2xl font-black ${laneColors.textColor} flex items-center gap-2`}
                >
                  <div
                    className={`${laneColors.badge} text-white px-3 py-1 rounded-lg text-xl`}
                  >
                    #{car.carNumber}
                  </div>
                  {formatTime(car.assignedTime)}
                </DrawerTitle>
              </DrawerHeader>

              <div className="p-4 space-y-6">
                {/* Car SVG Display */}
                {/* <div className="flex justify-center">
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <Car
                                        size="lg"
                                        color={car.imageColor}
                                    />
                                </div>
                            </div> */}

                {/* Students Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-gray-600" />
                    <h3 className="text-lg font-semibold">
                      {t("car.students")} ({car.students.length})
                    </h3>
                  </div>

                  <div
                    className="space-y-3 pr-2"
                    style={{
                      scrollbarWidth: "thin",
                      scrollbarColor: "#D1D5DB #F3F4F6",
                    }}
                  >
                    {car.students.map((student) => {
                      // Check if this student has a birthday today using the shared function
                      const studentHasBirthday = checkStudentBirthday(student);

                      return (
                        <div
                          key={student.id}
                          className={`flex items-center gap-3 p-3 border rounded-lg ${studentHasBirthday ? "bg-yellow-50 border-yellow-200" : "bg-white"}`}
                        >
                          <div className="relative">
                            <StudentAvatar
                              avatarStorageId={student.avatarStorageId}
                              fallbackUrl={student.imageUrl}
                              firstName={student.name.split(" ")[0] || ""}
                              lastName={
                                student.name.split(" ").slice(1).join(" ") ||
                                student.name
                              }
                              size="md"
                              className={`w-12 h-12 ${laneColors.background}`}
                            />
                            {studentHasBirthday && (
                              <div className="absolute -top-1 -right-1 bg-yellow-500 text-white rounded-full p-1">
                                <Cake className="h-3 w-3" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div
                              className={`font-semibold ${studentHasBirthday ? "text-yellow-800" : "text-gray-900"} flex items-center gap-2`}
                            >
                              {student.name}
                              {studentHasBirthday && (
                                <span className="text-xs bg-yellow-500 text-white px-2 py-1 rounded-full font-bold">
                                  {/* {t("birthdayMessage")} */}
                                  Happy birthday
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-sm text-gray-500">
                              <GraduationCap className="h-3 w-3" />
                              {student.grade || `${t("car.grade")} 5`}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    );
  },
);

CarCard.displayName = "CarCard";
