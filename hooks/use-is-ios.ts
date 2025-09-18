"use client"

import { useState, useEffect } from 'react'

/**
 * Hook para detectar dispositivos iOS de manera confiable
 * Incluye detección para iPhone, iPad, iPod y iPad Pro en modo desktop
 */
export const useIsIOS = () => {
  const [isIOS, setIsIOS] = useState(false)
  const [isChecked, setIsChecked] = useState(false)

  useEffect(() => {
    const detectIOS = () => {
      // Múltiples métodos de detección para mayor precisión
      const detectionMethods = {
        // Método 1: User Agent tradicional
        userAgent: /iPad|iPhone|iPod/.test(navigator.userAgent),
        
        // Método 2: Platform API
        platform: navigator.platform?.startsWith('iP') || false,
        
        // Método 3: iPad Pro que se reporta como Mac pero tiene touch
        macWithTouch: navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1,
        
        // Método 4: iOS Safari que cambió su user agent en iOS 13+
        safariMobile: navigator.userAgent.includes('Safari') && 
                     navigator.userAgent.includes('Mobile') && 
                     !navigator.userAgent.includes('Chrome') &&
                     !navigator.userAgent.includes('Edge')
      }
      
      // Si cualquier método detecta iOS, consideramos que es iOS
      const detected = Object.values(detectionMethods).some(Boolean)
      
      setIsIOS(detected)
      setIsChecked(true)
      
      // Debug logging (solo en desarrollo)
      if (process.env.NODE_ENV === 'development') {
        console.log('iOS Detection Result:', { 
          detected, 
          methods: detectionMethods,
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          maxTouchPoints: navigator.maxTouchPoints
        })
      }
    }

    // Ejecutar detección al montar el componente
    detectIOS()
  }, [])

  return { isIOS, isChecked }
}