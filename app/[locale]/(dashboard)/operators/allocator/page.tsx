import { DismissalView } from "@/components/dismissal/dismissal-view"

export default function AllocatorPage() {
    return (
        <div className="flex flex-1 flex-col gap-4 sm:px-4 pt-0">
            <DismissalView mode="allocator" />
        </div>
    )
}