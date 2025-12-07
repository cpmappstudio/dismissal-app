export function formatItemCount(count?: number): string {
    if (count === undefined || count === null) {
        return "No students";
    }
    return count === 1 ? "1 student" : `${count} students`;
}
