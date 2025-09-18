"use client"

import * as React from "react"
import { useState, useRef, useCallback } from 'react'
import { CardContent } from "@/components/ui/card"
import { useIsIOS } from "@/hooks/use-is-ios"
import { IOSScrollbarOverlay } from "./ios-scrollbar-overlay"

interface ScrollableContainerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'className' | 'style' | 'children'> {
  children: React.ReactNode
  isViewer?: boolean
  className?: string
  style?: React.CSSProperties
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void
}

/**
 * Container que decide entre implementación estándar (tu código actual) 
 * e implementación iOS con scrollbar simulada
 */
export const ScrollableContainer: React.FC<ScrollableContainerProps> = ({ 
  children, 
  isViewer = false, 
  className = '',
  style = {},
  ...restProps 
}) => {
  const { isIOS, isChecked } = useIsIOS()

  // Mostrar implementación estándar mientras detecta plataforma
  if (!isChecked) {
    return (
      <StandardContainer 
        isViewer={isViewer} 
        className={className}
        style={style}
        {...restProps}
      >
        {children}
      </StandardContainer>
    )
  }

  // Decisión: ¿iOS o implementación estándar?
  if (isIOS) {
    return (
      <IOSEnhancedContainer 
        isViewer={isViewer} 
        className={className}
        style={style}
        {...restProps}
      >
        {children}
      </IOSEnhancedContainer>
    )
  }

  // Tu implementación actual - SIN CAMBIOS
  return (
    <StandardContainer 
      isViewer={isViewer} 
      className={className}
      style={style}
      {...restProps}
    >
      {children}
    </StandardContainer>
  )
}

/**
 * Implementación estándar - TU CÓDIGO ACTUAL EXACTO
 * Se mantiene sin modificaciones para preservar funcionalidad existente
 */
const StandardContainer: React.FC<ScrollableContainerProps> = ({ 
  children, 
  isViewer, 
  className, 
  style,
  ...restProps 
}) => {
  return (
    <CardContent
      ref={(el) => {
        if (el) {
          // TU LÓGICA ACTUAL - COPIADA EXACTAMENTE
          let isScrollbarInteraction = false

          const handleTouchStart = (e: TouchEvent) => {
            const touch = e.touches[0]
            const rect = el.getBoundingClientRect()
            const scrollbarSize = 20 // Mobile scrollbar size (width/height)
            const touchX = touch.clientX - rect.left
            const touchY = touch.clientY - rect.top

            // Detectar si el touch está en la zona de scrollbar según el modo
            if (isViewer) {
              // Scroll horizontal: detectar scrollbar en la parte inferior
              isScrollbarInteraction = touchY >= rect.height - scrollbarSize
            } else {
              // Scroll vertical: detectar scrollbar en el lado derecho
              isScrollbarInteraction = touchX >= rect.width - scrollbarSize
            }

            // Check if touch is on an interactive element
            const touchTarget = e.target as Element
            const isInteractiveElement = touchTarget?.closest('button, [data-slot="drawer-trigger"], [role="button"], .cursor-pointer, .viewer-scroll-container')

            // Si NO es scrollbar Y NO es elemento interactivo, prevenir el touch start
            if (!isScrollbarInteraction && !isInteractiveElement) {
              e.preventDefault()
            }
          }

          // Solo bloquear touchmove si NO es interacción con scrollbar Y NO es elemento interactivo
          const handleTouchMove = (e: TouchEvent) => {
            const touchTarget = e.target as Element
            const isInteractiveElement = touchTarget?.closest('button, [data-slot="drawer-trigger"], [role="button"], .cursor-pointer, .viewer-scroll-container')

            if (!isScrollbarInteraction && !isInteractiveElement) {
              e.preventDefault()
              e.stopPropagation()
            }
          }

          // Reset flag al terminar touch
          const handleTouchEnd = () => {
            isScrollbarInteraction = false
          }

          // Bloquear teclas de dirección para scroll
          const handleKeyDown = (e: KeyboardEvent) => {
            const keysToBlock = isViewer
              ? ['ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', 'Space']
              : ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', 'Space']

            if (keysToBlock.includes(e.key)) {
              e.preventDefault()
              e.stopPropagation()
            }
          }

          // Agregar event listeners - TU CÓDIGO ACTUAL
          el.addEventListener('touchstart', handleTouchStart, { passive: false })
          el.addEventListener('touchmove', handleTouchMove, { passive: false })
          el.addEventListener('touchend', handleTouchEnd, { passive: true })
          el.addEventListener('keydown', handleKeyDown)

          // Inicializar posición de scroll según el modo - TU CÓDIGO ACTUAL
          setTimeout(() => {
            if (isViewer) {
              // En viewer mode, iniciar desde el inicio (scroll horizontal)
              el.scrollLeft = 0
            } else {
              // En otros modos, iniciar desde abajo (scroll vertical)
              el.scrollTop = el.scrollHeight
            }
          }, 0)

          // Cleanup function - TU CÓDIGO ACTUAL
          return () => {
            el.removeEventListener('touchstart', handleTouchStart)
            el.removeEventListener('touchmove', handleTouchMove)
            el.removeEventListener('touchend', handleTouchEnd)
            el.removeEventListener('keydown', handleKeyDown)
          }
        }
      }}
      className={`road-scroll-container ${isViewer ? 'overflow-x-scroll overflow-y-hidden' : 'overflow-y-scroll'} ${className}`}
      style={{
        WebkitOverflowScrolling: 'touch',
        ...style
      }}
      {...restProps}
    >
      {children}
    </CardContent>
  )
}

/**
 * Implementación mejorada para iOS con scrollbar simulada
 * Mantiene la misma experiencia visual pero funciona en iOS
 */
const IOSEnhancedContainer: React.FC<ScrollableContainerProps> = ({ 
  children, 
  isViewer, 
  className, 
  style,
  onScroll,
  ...restProps 
}) => {
  // Estados específicos para scrollbar simulada
  const [scrollbarState, setScrollbarState] = useState({
    visible: false,
    position: 0,
    isDragging: false
  })
  
  const containerRef = useRef<HTMLDivElement>(null)
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Calcular posición de scrollbar basada en scroll del contenedor
  const updateScrollbarPosition = useCallback(() => {
    if (!containerRef.current) return

    const element = containerRef.current
    const scrollRatio = isViewer 
      ? element.scrollLeft / Math.max(1, element.scrollWidth - element.clientWidth)
      : element.scrollTop / Math.max(1, element.scrollHeight - element.clientHeight)
    
    const position = Math.max(0, Math.min(100, scrollRatio * 100))
    
    setScrollbarState(prev => ({ ...prev, position }))
  }, [isViewer])

  // Mostrar scrollbar durante scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    updateScrollbarPosition()
    
    setScrollbarState(prev => ({ ...prev, visible: true }))
    
    // Ocultar después de inactividad (como scrollbars nativas de iOS)
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
    }
    hideTimeoutRef.current = setTimeout(() => {
      setScrollbarState(prev => ({ 
        ...prev, 
        visible: prev.isDragging ? true : false 
      }))
    }, 2000)

    // Llamar onScroll original si existe
    onScroll?.(e)
  }, [updateScrollbarPosition, onScroll])

  // Manejar drag de scrollbar simulada
  const handleScrollbarDrag = useCallback((dragPosition: number) => {
    if (!containerRef.current) return

    const element = containerRef.current
    const percentage = dragPosition / 100

    if (isViewer) {
      element.scrollLeft = percentage * (element.scrollWidth - element.clientWidth)
    } else {
      element.scrollTop = percentage * (element.scrollHeight - element.clientHeight)
    }
    
    setScrollbarState(prev => ({ ...prev, position: dragPosition }))
  }, [isViewer])

  return (
    <div className="relative">
      {/* Contenedor con scrollbar oculta pero funcional */}
      <CardContent
        ref={containerRef}
        onScroll={handleScroll}
        className={`road-scroll-container ios-enhanced ${isViewer ? 'overflow-x-scroll overflow-y-hidden' : 'overflow-y-scroll'} ${className}`}
        style={{
          WebkitOverflowScrolling: 'touch',
          // Ocultar scrollbar nativa en iOS pero mantener funcionalidad
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          ...style
        }}
        {...restProps}
      >
        {children}
      </CardContent>

      {/* Scrollbar simulada - Solo visible cuando es necesario */}
      <IOSScrollbarOverlay
        visible={scrollbarState.visible}
        position={scrollbarState.position}
        orientation={isViewer ? 'horizontal' : 'vertical'}
        onDrag={handleScrollbarDrag}
        onDragStart={() => setScrollbarState(prev => ({ ...prev, isDragging: true }))}
        onDragEnd={() => setScrollbarState(prev => ({ ...prev, isDragging: false }))}
      />
    </div>
  )
}