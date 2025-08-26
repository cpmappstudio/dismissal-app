export type Student = {
    id: string
    fullName: string
    firstName: string
    lastName: string
    birthday: string
    carNumber: number
    grade: string
    campusLocation: string
    avatarUrl?: string
}

export type Grade =
    | "Pre-Kinder"
    | "Kinder"
    | "1st"
    | "2nd"
    | "3rd"
    | "4th"
    | "5th"
    | "6th"
    | "7th"
    | "8th"
    | "9th"
    | "10th"
    | "11th"
    | "12th"
