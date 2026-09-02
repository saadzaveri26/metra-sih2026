import Image from "next/image";

export type AvatarState =
  | "welcome"
  | "scanning"
  | "loading"
  | "approved"
  | "warning"
  | "mismatch"
  | "converse"
  | "closeup";

const SRC: Record<AvatarState, string> = {
  welcome: "/avatar/welcome.png",
  scanning: "/avatar/scanning.png",
  loading: "/avatar/loading.png",
  approved: "/avatar/approved.png",
  warning: "/avatar/warning.png",
  mismatch: "/avatar/mismatch.png",
  converse: "/avatar/converse.png",
  closeup: "/avatar/closeup.png",
};

// Full-body renders are 1024x1536 (2:3), the closeup headshot is ~1158x1358 (~6:7)
const DIMENSIONS: Record<AvatarState, { w: number; h: number }> = {
  welcome: { w: 1024, h: 1536 },
  scanning: { w: 1024, h: 1536 },
  loading: { w: 1024, h: 1536 },
  approved: { w: 1024, h: 1536 },
  warning: { w: 1024, h: 1536 },
  mismatch: { w: 1024, h: 1536 },
  converse: { w: 1024, h: 1536 },
  closeup: { w: 1158, h: 1358 },
};

export default function Avatar({
  state,
  className = "",
  priority = false,
}: {
  state: AvatarState;
  className?: string;
  priority?: boolean;
}) {
  const { w, h } = DIMENSIONS[state];
  return (
    <Image
      src={SRC[state]}
      alt={`METRA officer avatar — ${state} state`}
      width={w}
      height={h}
      priority={priority}
      className={className}
    />
  );
}
