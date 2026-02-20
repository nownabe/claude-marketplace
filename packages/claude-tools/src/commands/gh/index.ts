export const commands: Record<string, () => Promise<void>> = {
  "add-sub-issues": () => import("./add-sub-issues").then((m) => m.main()),
  "list-sub-issues": () => import("./list-sub-issues").then((m) => m.main()),
  "resolve-tag-sha": () => import("./resolve-tag-sha").then((m) => m.main()),
};
