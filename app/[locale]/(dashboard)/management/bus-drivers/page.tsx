import StaffTable from "@/components/dashboard/staff-table/staff-table";

export default function BusDriversPage() {
  return (
    <div className="dashboard-container">
      <StaffTable driversOnly />
    </div>
  );
}
