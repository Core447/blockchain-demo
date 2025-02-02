import { Button, ButtonProps } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface LoadingButtonProps extends ButtonProps {
    // onClick: () => Promise<void> | void;
    isLoading: boolean
    text?: string
    // className?: string
    children?: React.ReactNode
}

export default function LoadingButton({onClick, isLoading, children, ...props}: LoadingButtonProps) {
    return (
        <Button onClick={onClick} disabled={isLoading} {...props}>
            {isLoading && <Loader2 className="animate-spin" />}
            {children}
        </Button>
    )
}