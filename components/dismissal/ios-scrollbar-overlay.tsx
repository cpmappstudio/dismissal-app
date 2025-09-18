"use client"

import * as React from "react"
import { useState, useRef, useCallback, useEffect } from 'react'

interface IOSScrollbarOverlayProps {
  visible: boolean
  position: number // 0-100 percentage
  orientation: 'horizontal' | 'vertical'
  onDrag: (position: number) => void
  onDragStart: () => void
  onDragEnd: () => void
}

/**
 * Scrollbar overlay que replica exactamente el diseño de road.css para iOS
 * Mantiene el mismo patrón visual, colores y comportamiento
 */
export const IOSScrollbarOverlay: React.FC<IOSScrollbarOverlayProps> = ({
  visible,
  position,
  orientation,
  onDrag,
  onDragStart,
  onDragEnd
}) => {
  const trackRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const isHorizontal = orientation === 'horizontal'

  // Convertir posición de mouse/touch a porcentaje
  const getPositionFromEvent = useCallback((clientPos: number) => {
    if (!trackRef.current) return 0

    const rect = trackRef.current.getBoundingClientRect()
    const thumbSize = 40 // Minimum touch target size matching road.css
    const trackSize = isHorizontal ? rect.width - thumbSize : rect.height - thumbSize
    
    const relativePos = isHorizontal 
      ? Math.max(0, Math.min(trackSize, clientPos - rect.left - (thumbSize / 2)))
      : Math.max(0, Math.min(trackSize, clientPos - rect.top - (thumbSize / 2)))
    
    return trackSize > 0 ? (relativePos / trackSize) * 100 : 0
  }, [isHorizontal])

  // Handlers para mouse (desktop)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    onDragStart()
    
    const newPosition = getPositionFromEvent(isHorizontal ? e.clientX : e.clientY)
    onDrag(newPosition)
  }, [getPositionFromEvent, isHorizontal, onDrag, onDragStart])

  // Handlers para touch (iOS)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    onDragStart()
    
    const touch = e.touches[0]
    const newPosition = getPositionFromEvent(isHorizontal ? touch.clientX : touch.clientY)
    onDrag(newPosition)
  }, [getPositionFromEvent, isHorizontal, onDrag, onDragStart])

  // Global mouse/touch move handlers durante drag
  useEffect(() => {
    if (!isDragging) return

    const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
      e.preventDefault()
      
      const clientPos = 'touches' in e 
        ? (isHorizontal ? e.touches[0]?.clientX : e.touches[0]?.clientY)
        : (isHorizontal ? e.clientX : e.clientY)
      
      if (clientPos !== undefined) {
        const newPosition = getPositionFromEvent(clientPos)
        onDrag(newPosition)
      }
    }

    const handleGlobalEnd = (e: MouseEvent | TouchEvent) => {
      e.preventDefault()
      setIsDragging(false)
      onDragEnd()
    }

    // Mouse events
    document.addEventListener('mousemove', handleGlobalMove, { passive: false })
    document.addEventListener('mouseup', handleGlobalEnd, { passive: false })
    
    // Touch events para iOS
    document.addEventListener('touchmove', handleGlobalMove, { passive: false })
    document.addEventListener('touchend', handleGlobalEnd, { passive: false })

    return () => {
      document.removeEventListener('mousemove', handleGlobalMove)
      document.removeEventListener('mouseup', handleGlobalEnd)
      document.removeEventListener('touchmove', handleGlobalMove)
      document.removeEventListener('touchend', handleGlobalEnd)
    }
  }, [isDragging, getPositionFromEvent, onDrag, onDragEnd, isHorizontal])

  // Calcular tamaños responsivos que coinciden con road.css
  const getResponsiveSize = () => {
    const isMobile = window.innerWidth <= 768
    return {
      trackSize: isMobile ? 20 : 16, // Coincide con road.css media queries
      thumbSize: 40 // min-height/min-width de road.css
    }
  }

  const { trackSize, thumbSize } = getResponsiveSize()

  return (
    <div 
      className={`absolute pointer-events-auto transition-opacity duration-200 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      } ${
        isHorizontal 
          ? `bottom-0 left-0 right-0 flex items-center px-1`
          : `top-0 right-0 bottom-0 flex flex-col items-center py-1`
      }`}
      style={{ 
        zIndex: 1000,
        height: isHorizontal ? `${trackSize}px` : 'auto',
        width: !isHorizontal ? `${trackSize}px` : 'auto'
      }}
    >
      {/* Track - Exactamente como en road.css */}
      <div 
        ref={trackRef}
        className={`relative cursor-pointer ${
          isHorizontal ? 'flex-1' : 'flex-1'
        }`}
        style={{ 
          backgroundColor: 'rgba(229, 231, 235, 0.8)', // Matching road.css
          borderRadius: '8px',
          width: isHorizontal ? '100%' : `${trackSize - 4}px`,
          height: !isHorizontal ? '100%' : `${trackSize - 4}px`
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Thumb - Con el patrón exacto de road.css */}
        <div
          className={`absolute cursor-grab active:cursor-grabbing transition-all duration-100 ${
            isDragging ? 'scale-105' : ''
          }`}
          style={{
            // Patrón exacto de repeating-linear-gradient de road.css
            background: isDragging 
              ? `repeating-linear-gradient(
                  45deg,
                  #d97706 0px,
                  #d97706 8px,
                  #f59e0b 8px,
                  #f59e0b 16px
                )` // Active state de road.css
              : `repeating-linear-gradient(
                  45deg,
                  #f59e0b 0px,
                  #f59e0b 8px,
                  #fbbf24 8px,
                  #fbbf24 16px
                )`, // Normal state de road.css
            border: '2px solid rgba(229, 231, 235, 0.8)', // Matching road.css
            borderRadius: '8px',
            width: isHorizontal ? `${thumbSize}px` : `${trackSize - 4}px`,
            height: !isHorizontal ? `${thumbSize}px` : `${trackSize - 4}px`,
            [isHorizontal ? 'left' : 'top']: `calc(${Math.max(0, Math.min(100, position))}% - ${thumbSize / 2}px)`,
            // Prevenir que el thumb se salga del track
            [isHorizontal ? 'maxLeft' : 'maxTop']: `calc(100% - ${thumbSize}px)`
          }}
        />
      </div>
    </div>
  )
}