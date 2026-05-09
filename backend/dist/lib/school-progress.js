/** Pipeline-style completion for the progress bar (0–100). */
export function progressFromStatus(status) {
    switch (status) {
        case "PLANNING":
            return 12;
        case "APPLIED":
            return 38;
        case "WAITING":
            return 62;
        case "ACCEPTED":
            return 100;
        case "REJECTED":
            return 88;
        case "WITHDRAWN":
            return 45;
        default:
            return 12;
    }
}
