// hooks/use-campus-session.ts
"use client"

import { useState, useEffect } from 'react'

const CAMPUS_SESSION_KEY = 'dismissal-app-selected-campus'

/**
 * Hook para manejar la selección de campus durante la sesión
 * - Persiste el campus seleccionado en localStorage
 * - Se mantiene entre cambios de roles
 * - Se borra al cerrar la sesión o pestaña (sessionStorage behavior)
 */
export function useCampusSession() {
    const [selectedCampus, setSelectedCampus] = useState<string>("")
    const [isLoaded, setIsLoaded] = useState(false)

    // Cargar el campus desde localStorage al montar
    useEffect(() => {
        try {
            const savedCampus = localStorage.getItem(CAMPUS_SESSION_KEY)
            if (savedCampus) {
                setSelectedCampus(savedCampus)
            }
        } catch (error) {
            // Ignore localStorage errors (SSR, private browsing, etc.)
        } finally {
            setIsLoaded(true)
        }
    }, [])

    // Escuchar cambios en localStorage para sincronizar entre pestañas/páginas
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === CAMPUS_SESSION_KEY) {
                setSelectedCampus(e.newValue || "")
            }
        }

        window.addEventListener('storage', handleStorageChange)
        return () => window.removeEventListener('storage', handleStorageChange)
    }, [])

    // Función para actualizar el campus y persistirlo
    const updateSelectedCampus = (campus: string) => {
        setSelectedCampus(campus)

        try {
            if (campus && campus !== "") {
                localStorage.setItem(CAMPUS_SESSION_KEY, campus)
            } else {
                localStorage.removeItem(CAMPUS_SESSION_KEY)
            }
        } catch (error) {
            // Ignore localStorage errors
        }
    }

    // Función para limpiar la selección
    const clearSelectedCampus = () => {
        setSelectedCampus("")
        try {
            localStorage.removeItem(CAMPUS_SESSION_KEY)
        } catch (error) {
            // Ignore localStorage errors
        }
    }

    return {
        selectedCampus,
        updateSelectedCampus,
        clearSelectedCampus,
        isLoaded // Para evitar hydration mismatch
    }
}