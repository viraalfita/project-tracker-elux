import PocketBase from "pocketbase";

const PB_URL =
  process.env.NEXT_PUBLIC_POCKETBASE_URL ?? "https://devpb.eluxemang.top";

export const pb = new PocketBase(PB_URL);

// Prevent React concurrent mode from cancelling parallel in-flight requests
pb.autoCancellation(false);
