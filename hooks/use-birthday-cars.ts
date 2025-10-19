import { useMemo } from 'react'
import type { CarData } from '@/components/dismissal/types'

interface BirthdayCarResult {
    carId: string
    carNumber: number
    studentsWithBirthday: {
        id: string
        name: string
        birthday: string
    }[]
}

interface UseBirthdayCarsReturn {
    /** Set de IDs de carros que tienen estudiantes cumpliendo años hoy */
    birthdayCarIds: Set<string>
    /** Array detallado de carros con estudiantes de cumpleaños */
    birthdayCars: BirthdayCarResult[]
    /** Función helper para verificar si un carro tiene estudiantes de cumpleaños */
    hasCarBirthday: (carId: string) => boolean
}

/**
 * Hook que verifica si algún carro tiene estudiantes cumpliendo años hoy
 * 
 * @param cars - Array de carros con sus estudiantes asociados
 * @returns Objeto con información sobre carros con estudiantes de cumpleaños
 */
export function useBirthdayCars(cars: CarData[]): UseBirthdayCarsReturn {
    return useMemo(() => {
        // Obtener fecha actual en UTC-5 (Eastern Time)
        const now = new Date()
        const utc5Date = new Date(now.getTime() - (5 * 60 * 60 * 1000)) // UTC-5
        
        // Formatear fecha actual como MM/DD (sin año)
        const currentMonth = String(utc5Date.getUTCMonth() + 1).padStart(2, '0')
        const currentDay = String(utc5Date.getUTCDate()).padStart(2, '0')
        const todayMMDD = `${currentMonth}/${currentDay}`

        const birthdayCars: BirthdayCarResult[] = []
        const birthdayCarIds = new Set<string>()

        // Procesar cada carro
        cars.forEach(car => {
            const studentsWithBirthday: BirthdayCarResult['studentsWithBirthday'] = []

            // Verificar cada estudiante del carro
            car.students.forEach(student => {
                if (!student.birthday) return

                try {
                    // Extraer MM/DD del birthday del estudiante (formato: MM/DD/YYYY)
                    const birthdayParts = student.birthday.split('/')
                    if (birthdayParts.length >= 2) {
                        const studentMMDD = `${birthdayParts[0].padStart(2, '0')}/${birthdayParts[1].padStart(2, '0')}`
                        
                        // Comparar solo mes y día (ignorar año)
                        if (studentMMDD === todayMMDD) {
                            studentsWithBirthday.push({
                                id: student.id,
                                name: student.name,
                                birthday: student.birthday
                            })
                        }
                    }
                } catch (error) {
                    // Silenciosamente ignorar formatos de fecha inválidos
                    console.warn(`Invalid birthday format for student ${student.name}: ${student.birthday}`)
                }
            })

            // Si el carro tiene estudiantes con cumpleaños, agregarlo a los resultados
            if (studentsWithBirthday.length > 0) {
                birthdayCars.push({
                    carId: car.id,
                    carNumber: car.carNumber,
                    studentsWithBirthday
                })
                birthdayCarIds.add(car.id)
            }
        })

        // Función helper para verificar si un carro específico tiene cumpleaños
        const hasCarBirthday = (carId: string): boolean => {
            return birthdayCarIds.has(carId)
        }

        return {
            birthdayCarIds,
            birthdayCars,
            hasCarBirthday
        }
    }, [cars]) // Recalcular cuando cambie la lista de carros
}