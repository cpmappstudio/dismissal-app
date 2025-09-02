import { CarData } from './types'

export const MOCK_CARS: CarData[] = [
    {
        id: 'car-1',
        carNumber: 101,
        lane: 'left',
        position: 1,
        assignedTime: new Date('2024-01-01T09:05:00'),
        students: [{ id: 'student-1', name: 'María González', grade: 'Grado 5' }],
        campus: 'Poinciana Campus',
        imageColor: '#3b82f6' // Azul
    },
    {
        id: 'car-2',
        carNumber: 205,
        lane: 'left',
        position: 2,
        assignedTime: new Date('2024-01-01T09:07:00'),
        students: [
            { id: 'student-2', name: 'Carlos Rodríguez', grade: 'Grado 4' },
            { id: 'student-3', name: 'Ana Sofía Rodríguez', grade: 'Grado 2' }
        ],
        campus: 'Poinciana Campus',
        imageColor: '#8b5cf6' // Púrpura
    },
    {
        id: 'car-3',
        carNumber: 89,
        lane: 'right',
        position: 1,
        assignedTime: new Date('2024-01-01T09:03:00'),
        students: [{ id: 'student-4', name: 'Ana Martínez', grade: 'Grado 6' }],
        campus: 'Poinciana Campus',
        imageColor: '#10b981' // Verde
    },
    {
        id: 'car-4',
        carNumber: 156,
        lane: 'right',
        position: 2,
        assignedTime: new Date('2024-01-01T09:08:00'),
        students: [
            { id: 'student-5', name: 'Pedro Sánchez', grade: 'Grado 3' },
            { id: 'student-6', name: 'Isabella Sánchez', grade: 'Grado 1' },
            { id: 'student-7', name: 'Diego Sánchez', grade: 'Grado 5' }
        ],
        campus: 'Poinciana Campus',
        imageColor: '#ef4444' // Rojo
    },
    {
        id: 'car-5',
        carNumber: 78,
        lane: 'right',
        position: 3,
        assignedTime: new Date('2024-01-01T09:09:00'),
        students: [{ id: 'student-8', name: 'Laura Torres', grade: 'Grado 4' }],
        campus: 'Poinciana Campus',
        imageColor: '#f97316' // Naranja
    }
]

// Initial nextId for mock data
export const INITIAL_NEXT_ID = 6
