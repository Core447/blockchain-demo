import { Loader2, Pickaxe } from "lucide-react"
import { cn } from "@/lib/utils"

interface LoadingOverlayProps {
  isVisible: boolean
  message?: string
  className?: string
}

export function LoadingOverlay({ isVisible, message = "Loading...", className }: LoadingOverlayProps) {
  if (!isVisible) return null

  return (
    <div 
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm",
        className
      )}
    >
      <div className="flex flex-col items-center gap-4 rounded-lg bg-card p-8 shadow-lg border">
        <div className="relative">
          <Pickaxe className="h-8 w-8 text-primary animate-bounce" />
          <Loader2 className="h-4 w-4 text-muted-foreground animate-spin absolute -bottom-1 -right-1" />
        </div>
        <p className="text-lg font-medium text-foreground">{message}</p>
      </div>
    </div>
  )
}
