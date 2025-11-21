import { StudentsTable } from "@/components/dashboard/students-table";

export default async function StudentsPage() {
  return (
    <div className="dashboard-container">
      <StudentsTable/>
    </div>
  );
}
