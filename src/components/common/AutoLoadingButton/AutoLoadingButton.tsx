import { Button, ButtonProps } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useState } from "react";

interface LoadingButtonProps extends ButtonProps {
    onClick: () => Promise<void> | void;
    // className?: string
    children?: React.ReactNode
}

export default function AutoLoadingButton({onClick, children, ...props}: LoadingButtonProps) {
    const [isLoading, setIsLoading] = useState(false);

    async function handleOnClick() {
        setIsLoading(true);
        await onClick();
        setIsLoading(false);
    }

    return (
        <Button onClick={handleOnClick} disabled={isLoading} {...props}>
            {isLoading && <Loader2 className="animate-spin" />}
            {children}
        </Button>
    )
}