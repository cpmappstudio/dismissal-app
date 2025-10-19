"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Maximize, Minimize } from "lucide-react";
import { Lane } from "./lane";
import { CarData, ModeType } from "./types";
import "./road.css";

interface RoadProps {
  leftLaneCars: CarData[];
  rightLaneCars: CarData[];
  mode: ModeType;
  onRemoveCar: (carId: string) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  className?: string;
  birthdayCarIds?: Set<string>;
}

export const Road = React.memo<RoadProps>(
  ({
    leftLaneCars,
    rightLaneCars,
    mode,
    onRemoveCar,
    isFullscreen = false,
    onToggleFullscreen,
    birthdayCarIds,
  }) => {
    const t = useTranslations("common");
    const isViewer = mode === "viewer";

    // Handle ESC key to exit fullscreen
    React.useEffect(() => {
      const handleEscKey = (event: KeyboardEvent) => {
        if (event.key === "Escape" && isFullscreen && onToggleFullscreen) {
          onToggleFullscreen();
        }
      };

      if (isFullscreen) {
        document.addEventListener("keydown", handleEscKey);
        return () => document.removeEventListener("keydown", handleEscKey);
      }
    }, [isFullscreen, onToggleFullscreen]);

    return (
      <div
        className={`flex-1 min-h-0 ${isFullscreen ? "fixed inset-0 z-[9999] bg-white" : ""}`}
        style={{ marginBottom: mode === "allocator" ? "6rem" : "0" }}
      >
        <Card
          className={`border-2 border-yankees-blue flex flex-col py-0 overflow-hidden relative ${
            isFullscreen
              ? "h-screen max-h-screen"
              : mode === "viewer" || mode === "dispatcher"
                ? "h-[calc(100vh-9rem)] md:max-w-[calc(100vw-20rem)] max-h-[calc(100vh-9rem)] mb-4"
                : "h-[calc(100vh-12rem)] max-h-[calc(100vh-12rem)]"
          }`}
          style={{ backgroundColor: "#9CA3AF" }}
        >
          {/* Fullscreen Toggle Button - Only visible in viewer mode */}
          {isViewer && onToggleFullscreen && (
            <Button
              onClick={onToggleFullscreen}
              variant="secondary"
              size="sm"
              title={isFullscreen ? t("exitFullscreen") : t("enterFullscreen")}
              className="absolute top-2 right-2 z-50 bg-white/90 hover:bg-white border border-gray-300 p-2 h-8 w-8 rounded-lg shadow-sm transition-all duration-200"
            >
              {isFullscreen ? (
                <Minimize className="h-4 w-4 text-gray-700" />
              ) : (
                <Maximize className="h-4 w-4 text-gray-700" />
              )}
            </Button>
          )}

          <CardContent
            ref={(el) => {
              if (el) {
                // Posicionar el scroll según el modo
                setTimeout(() => {
                  if (isViewer) {
                    // En viewer mode, iniciar desde el inicio (scroll horizontal en desktop, vertical en mobile)
                    const isMobile = window.innerWidth < 768; // md breakpoint
                    if (isMobile) {
                      el.scrollTop = el.scrollHeight;
                    } else {
                      el.scrollLeft = 0;
                    }
                  } else {
                    // En otros modos, iniciar desde abajo (scroll vertical)
                    el.scrollTop = el.scrollHeight;
                  }
                }, 0);
              }
            }}
            //         let isScrollbarInteraction = false

            //         // Bloquear scroll de rueda (mouse wheel)
            //         // const handleWheel = (e: WheelEvent) => {
            //         //     e.preventDefault()
            //         //     e.stopPropagation()
            //         // }

            //         // Detectar inicio de touch en scrollbar
            //         const handleTouchStart = (e: TouchEvent) => {
            //             const touch = e.touches[0]
            //             const rect = el.getBoundingClientRect()
            //             const scrollbarSize = 20 // Mobile scrollbar size (width/height)
            //             const touchX = touch.clientX - rect.left
            //             const touchY = touch.clientY - rect.top

            //             // Detectar si el touch está en la zona de scrollbar según el modo
            //             if (isViewer) {
            //                 // Scroll horizontal: detectar scrollbar en la parte inferior
            //                 isScrollbarInteraction = touchY >= rect.height - scrollbarSize
            //             } else {
            //                 // Scroll vertical: detectar scrollbar en el lado derecho
            //                 isScrollbarInteraction = touchX >= rect.width - scrollbarSize
            //             }

            //             // Check if touch is on an interactive element
            //             const touchTarget = e.target as Element
            //             const isInteractiveElement = touchTarget?.closest('button, [data-slot="drawer-trigger"], [role="button"], .cursor-pointer, .viewer-scroll-container')

            //             // Si NO es scrollbar Y NO es elemento interactivo, prevenir el touch start
            //             if (!isScrollbarInteraction && !isInteractiveElement) {
            //                 e.preventDefault()
            //             }
            //         }

            //         // Solo bloquear touchmove si NO es interacción con scrollbar Y NO es elemento interactivo
            //         const handleTouchMove = (e: TouchEvent) => {
            //             const touchTarget = e.target as Element
            //             const isInteractiveElement = touchTarget?.closest('button, [data-slot="drawer-trigger"], [role="button"], .cursor-pointer, .viewer-scroll-container')

            //             if (!isScrollbarInteraction && !isInteractiveElement) {
            //                 e.preventDefault()
            //                 e.stopPropagation()
            //             }
            //         }

            //         // Reset flag al terminar touch
            //         const handleTouchEnd = () => {
            //             isScrollbarInteraction = false
            //         }

            //         // Bloquear teclas de dirección para scroll
            //         const handleKeyDown = (e: KeyboardEvent) => {
            //             const keysToBlock = isViewer
            //                 ? ['ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', 'Space']
            //                 : ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', 'Space']

            //             if (keysToBlock.includes(e.key)) {
            //                 e.preventDefault()
            //                 e.stopPropagation()
            //             }
            //         }

            //         // el.addEventListener('wheel', handleWheel, { passive: false })
            //         el.addEventListener('touchstart', handleTouchStart, { passive: false })
            //         el.addEventListener('touchmove', handleTouchMove, { passive: false })
            //         el.addEventListener('touchend', handleTouchEnd, { passive: true })
            //         el.addEventListener('keydown', handleKeyDown)
            //         // Cleanup function
            //         return () => {
            //             // el.removeEventListener('wheel', handleWheel)
            //             el.removeEventListener('touchstart', handleTouchStart)
            //             el.removeEventListener('touchmove', handleTouchMove)
            //             el.removeEventListener('touchend', handleTouchEnd)
            //             el.removeEventListener('keydown', handleKeyDown)
            //         }
            //     }
            // }}
            className={`flex-1 min-h-0 p-0 relative road-scroll-container ${isViewer ? "max-md:overflow-y-scroll md:overflow-x-scroll md:overflow-y-hidden" : "overflow-y-scroll"}`}
            style={{
              WebkitOverflowScrolling: "touch",
            }}
          >
            <div
              className={`relative ${isViewer ? "max-md:min-h-full max-md:flex md:min-w-max md:h-full md:flex md:flex-col" : "min-h-full flex"}`}
            >
              {/* Road Divider Line - Conditional orientation */}
              <div
                className={`absolute z-5 ${
                  isViewer
                    ? "max-md:left-1/2 max-md:top-0 max-md:bottom-16 max-md:w-2 max-md:-translate-x-1/2 md:top-1/2 md:left-16 md:h-2 md:-translate-y-1/2 md:w-full"
                    : "left-1/2 top-0 bottom-16 w-2 -translate-x-1/2"
                }`}
              >
                {/* Mobile vertical line */}
                {isViewer && (
                  <div
                    className="md:hidden absolute inset-0"
                    style={{
                      background: `repeating-linear-gradient(
                                        to bottom,
                                        #ffffff 0px,
                                        #ffffff 20px,
                                        transparent 20px,
                                        transparent 40px
                                    )`,
                    }}
                  />
                )}
                {/* Desktop horizontal line */}
                {isViewer && (
                  <div
                    className="max-md:hidden absolute inset-0"
                    style={{
                      background: `repeating-linear-gradient(
                                        to right,
                                        #ffffff 0px,
                                        #ffffff 20px,
                                        transparent 20px,
                                        transparent 40px
                                    )`,
                    }}
                  />
                )}
                {/* Non-viewer mode vertical line */}
                {!isViewer && (
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `repeating-linear-gradient(
                                        to bottom,
                                        #ffffff 0px,
                                        #ffffff 20px,
                                        transparent 20px,
                                        transparent 40px
                                    )`,
                    }}
                  />
                )}
              </div>

              {/* Lanes - Conditional layout */}
              <Lane
                cars={leftLaneCars}
                lane="left"
                mode={mode}
                onRemoveCar={onRemoveCar}
                birthdayCarIds={birthdayCarIds}
              />

              <Lane
                cars={rightLaneCars}
                lane="right"
                mode={mode}
                onRemoveCar={onRemoveCar}
                birthdayCarIds={birthdayCarIds}
              />

              {/* Zebra Pattern - Conditional position and orientation */}
              <div
                className={`absolute z-5 ${
                  isViewer
                    ? "max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:h-16 md:top-0 md:bottom-0 md:left-0 md:w-16"
                    : "bottom-0 left-0 right-0 h-16"
                }`}
                style={{ backgroundColor: "#9CA3AF" }}
              >
                {/* Border lines */}
                <div
                  className={`absolute bg-white ${
                    isViewer
                      ? "max-md:top-0 max-md:left-0 max-md:right-0 max-md:h-0.5 md:top-0 md:bottom-0 md:right-0 md:w-0.5"
                      : "top-0 left-0 right-0 h-0.5"
                  }`}
                ></div>
                <div
                  className={`absolute bg-white ${
                    isViewer
                      ? "max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:h-0.5 md:top-0 md:bottom-0 md:left-0 md:w-0.5"
                      : "bottom-0 left-0 right-0 h-0.5"
                  }`}
                ></div>
                {/* Lines pattern */}
                <div
                  className={`absolute ${
                    isViewer
                      ? "max-md:left-0 max-md:right-0 max-md:top-2 max-md:bottom-2 md:top-2 md:bottom-2 md:left-0 md:right-2"
                      : "left-0 right-0 top-2 bottom-2"
                  }`}
                >
                  {/* Mobile horizontal pattern */}
                  {isViewer && (
                    <div
                      className="md:hidden absolute inset-0"
                      style={{
                        background: `repeating-linear-gradient(
                                            90deg,
                                            transparent 0px,
                                            transparent 20px,
                                            #ffffff 20px,
                                            #ffffff 36px
                                        )`,
                      }}
                    />
                  )}
                  {/* Desktop vertical pattern */}
                  {isViewer && (
                    <div
                      className="max-md:hidden absolute inset-0"
                      style={{
                        background: `repeating-linear-gradient(
                                            to bottom,
                                            transparent 0px,
                                            transparent 20px,
                                            #ffffff 20px,
                                            #ffffff 36px
                                        )`,
                      }}
                    />
                  )}
                  {/* Non-viewer mode horizontal pattern */}
                  {!isViewer && (
                    <div
                      className="absolute inset-0"
                      style={{
                        background: `repeating-linear-gradient(
                                            90deg,
                                            transparent 0px,
                                            transparent 20px,
                                            #ffffff 20px,
                                            #ffffff 36px
                                        )`,
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  },
);

Road.displayName = "Road";
