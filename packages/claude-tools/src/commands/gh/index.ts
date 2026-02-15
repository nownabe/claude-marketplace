export const commands: Record<string, () => Promise<void>> = {
  "add-sub-issue": () => import("./add-sub-issue").then((m) => m.main()),
};
