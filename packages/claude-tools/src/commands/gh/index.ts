export const commands: Record<string, () => Promise<void>> = {
  "add-sub-issue": () => import("./add-sub-issue").then((m) => m.main()),
  "list-sub-issues": () => import("./list-sub-issues").then((m) => m.main()),
};
