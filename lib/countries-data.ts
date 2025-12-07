// Countries list for CPCA campuses
export const countries = [
    { value: "US", label: "United States" },
    { value: "HN", label: "Honduras" },
    { value: "PR", label: "Puerto Rico" },
];

// States/Provinces by country
export const statesByCountry: Record<string, { value: string; label: string }[]> = {
    US: [ // United States
        { value: "AL", label: "Alabama" },
        { value: "AK", label: "Alaska" },
        { value: "AZ", label: "Arizona" },
        { value: "AR", label: "Arkansas" },
        { value: "CA", label: "California" },
        { value: "CO", label: "Colorado" },
        { value: "CT", label: "Connecticut" },
        { value: "DE", label: "Delaware" },
        { value: "FL", label: "Florida" },
        { value: "GA", label: "Georgia" },
        { value: "HI", label: "Hawaii" },
        { value: "ID", label: "Idaho" },
        { value: "IL", label: "Illinois" },
        { value: "IN", label: "Indiana" },
        { value: "IA", label: "Iowa" },
        { value: "KS", label: "Kansas" },
        { value: "KY", label: "Kentucky" },
        { value: "LA", label: "Louisiana" },
        { value: "ME", label: "Maine" },
        { value: "MD", label: "Maryland" },
        { value: "MA", label: "Massachusetts" },
        { value: "MI", label: "Michigan" },
        { value: "MN", label: "Minnesota" },
        { value: "MS", label: "Mississippi" },
        { value: "MO", label: "Missouri" },
        { value: "MT", label: "Montana" },
        { value: "NE", label: "Nebraska" },
        { value: "NV", label: "Nevada" },
        { value: "NH", label: "New Hampshire" },
        { value: "NJ", label: "New Jersey" },
        { value: "NM", label: "New Mexico" },
        { value: "NY", label: "New York" },
        { value: "NC", label: "North Carolina" },
        { value: "ND", label: "North Dakota" },
        { value: "OH", label: "Ohio" },
        { value: "OK", label: "Oklahoma" },
        { value: "OR", label: "Oregon" },
        { value: "PA", label: "Pennsylvania" },
        { value: "RI", label: "Rhode Island" },
        { value: "SC", label: "South Carolina" },
        { value: "SD", label: "South Dakota" },
        { value: "TN", label: "Tennessee" },
        { value: "TX", label: "Texas" },
        { value: "UT", label: "Utah" },
        { value: "VT", label: "Vermont" },
        { value: "VA", label: "Virginia" },
        { value: "WA", label: "Washington" },
        { value: "WV", label: "West Virginia" },
        { value: "WI", label: "Wisconsin" },
        { value: "WY", label: "Wyoming" },
    ],
    HN: [ // Honduras - Departments
        { value: "AT", label: "Atlántida" },
        { value: "CH", label: "Choluteca" },
        { value: "CL", label: "Colón" },
        { value: "CM", label: "Comayagua" },
        { value: "CP", label: "Copán" },
        { value: "CR", label: "Cortés" },
        { value: "EP", label: "El Paraíso" },
        { value: "FM", label: "Francisco Morazán" },
        { value: "GD", label: "Gracias a Dios" },
        { value: "IN", label: "Intibucá" },
        { value: "IB", label: "Islas de la Bahía" },
        { value: "LP", label: "La Paz" },
        { value: "LE", label: "Lempira" },
        { value: "OC", label: "Ocotepeque" },
        { value: "OL", label: "Olancho" },
        { value: "SB", label: "Santa Bárbara" },
        { value: "VA", label: "Valle" },
        { value: "YO", label: "Yoro" },
    ],
    PR: [ // Puerto Rico - Regions/Municipalities
        { value: "SJ", label: "San Juan" },
        { value: "BY", label: "Bayamón" },
        { value: "CR", label: "Carolina" },
        { value: "PN", label: "Ponce" },
        { value: "CG", label: "Caguas" },
        { value: "GU", label: "Guaynabo" },
        { value: "MY", label: "Mayagüez" },
        { value: "TR", label: "Trujillo Alto" },
        { value: "AR", label: "Arecibo" },
        { value: "FJ", label: "Fajardo" },
    ],
};

// Cities by state/department/municipality - for filtering
export const citiesByState: Record<string, Record<string, { value: string; label: string }[]>> = {
    US: {
        FL: [ // Florida
            { value: "jacksonville", label: "Jacksonville" },
            { value: "miami", label: "Miami" },
            { value: "tampa", label: "Tampa" },
            { value: "orlando", label: "Orlando" },
            { value: "st_petersburg", label: "St. Petersburg" },
            { value: "hialeah", label: "Hialeah" },
            { value: "tallahassee", label: "Tallahassee" },
            { value: "fort_lauderdale", label: "Fort Lauderdale" },
            { value: "port_st_lucie", label: "Port St. Lucie" },
            { value: "kissimmee", label: "Kissimmee" },
            { value: "cape_coral", label: "Cape Coral" },
            { value: "pembroke_pines", label: "Pembroke Pines" },
            { value: "hollywood", label: "Hollywood" },
            { value: "miramar", label: "Miramar" },
            { value: "gainesville", label: "Gainesville" },
        ],
        // Other states can be added as needed
    },
    HN: {
        FM: [ // Francisco Morazán - Capital department
            { value: "tegucigalpa", label: "Tegucigalpa" },
        ],
        CR: [ // Cortés - Industrial hub
            { value: "san_pedro_sula", label: "San Pedro Sula" },
            { value: "choloma", label: "Choloma" },
        ],
        AT: [ // Atlántida - North coast
            { value: "la_ceiba", label: "La Ceiba" },
            { value: "tela", label: "Tela" },
        ],
    },
    PR: {
        SJ: [ // San Juan area
            { value: "san_juan", label: "San Juan" },
            { value: "condado", label: "Condado" },
            { value: "old_san_juan", label: "Old San Juan" },
        ],
        BY: [ // Bayamón area
            { value: "bayamon", label: "Bayamón" },
        ],
        CR: [ // Carolina area
            { value: "carolina", label: "Carolina" },
            { value: "isla_verde", label: "Isla Verde" },
        ],
        PN: [ // Ponce area
            { value: "ponce", label: "Ponce" },
        ],
    },
};

// Helper function to get states by country
export function getStatesByCountry(countryCode: string) {
    return statesByCountry[countryCode] || [];
}

// Helper function to get cities by country and state
export function getCitiesByCountryAndState(countryCode: string, stateCode: string) {
    return citiesByState[countryCode]?.[stateCode] || [];
}
