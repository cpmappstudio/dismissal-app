import { DismissalView } from "@/components/dismissal/dismissal-view"

export default function ViewerPage() {
    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 sm:px-4 pt-0">
            <DismissalView mode="viewer" />
        </div>
    )
}
