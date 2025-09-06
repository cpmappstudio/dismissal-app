// hooks/use-debounced-value.ts

import * as React from "react"

/**
 * Hook que retorna un valor debouncado
 * Útil para optimizar búsquedas en tiempo real
 */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
    const [debouncedValue, setDebouncedValue] = React.useState<T>(value)

    React.useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value)
        }, delay)

        return () => {
            clearTimeout(handler)
        }
    }, [value, delay])

    return debouncedValue
}

/**
 * Hook que combina estado y debounce para búsquedas
 */
export function useDebouncedSearch(initialValue: string = "", delay: number = 300) {
    const [searchValue, setSearchValue] = React.useState(initialValue)
    const debouncedSearch = useDebouncedValue(searchValue, delay)

    return {
        searchValue,
        setSearchValue,
        debouncedSearch
    }
}
