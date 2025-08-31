// Campus locations available in the system
export const CAMPUS_LOCATIONS = [
    "Poinciana Campus",
    "Simpson Campus",
    "Neptune Campus",
    "Downtown Middle",
    "Learning Center",
    "Honduras",
    "Puerto Rico"
] as const

// Academic grades supported by the system
export const GRADES = [
    "Pre-Kinder",
    "Kinder",
    "1st",
    "2nd",
    "3rd",
    "4th",
    "5th",
    "6th",
    "7th",
    "8th",
    "9th",
    "10th",
    "11th",
    "12th"
] as const

// Type exports for convenience
export type CampusLocation = typeof CAMPUS_LOCATIONS[number]
export type Grade = typeof GRADES[number]
