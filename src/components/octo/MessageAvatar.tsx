import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { avatarGradient, getFirstChar } from "@/utils/avatar";
import { cn } from "@/utils/cn";

export function MessageAvatar({
  name,
  src,
  className,
}: {
  name: string;
  src?: string | undefined;
  className?: string;
}) {
  return (
    <Avatar className={cn("h-8 w-8 shrink-0", className)}>
      {src && <AvatarImage src={src} alt={name} />}
      <AvatarFallback
        className="text-[11px] text-white"
        style={{ background: avatarGradient(name) }}
      >
        {getFirstChar(name)}
      </AvatarFallback>
    </Avatar>
  );
}
