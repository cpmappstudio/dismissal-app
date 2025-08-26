"use client"

import { StudentsTable } from './students-table'

export default function AdminDashboard() {
    return (
        <div className="@container/main space-y-4 md:space-y-6 lg:px-6">
            <StudentsTable />
        </div>
    )
}
