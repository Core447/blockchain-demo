import { Badge } from "../ui/badge";

export default function ValidInvalidBadge({isValid}: {isValid: boolean}) {
    return (
        <Badge variant={isValid ? "success" : "destructive"}>{isValid ? "Valid" : "Invalid"}</Badge>
    )
}