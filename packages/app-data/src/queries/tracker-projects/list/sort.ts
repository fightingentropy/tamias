import type { TrackerProjectListItem } from "../types";

export function sortTrackerProjects(
  data: TrackerProjectListItem[],
  sort?: string[] | null,
) {
  const [column, direction = "desc"] = sort ?? [];
  const isAscending = direction === "asc";
  const ordered = [...data];

  ordered.sort((left, right) => {
    const compare = (() => {
      switch (column) {
        case "time":
          return left.totalDuration - right.totalDuration;
        case "amount":
          return left.totalAmount - right.totalAmount;
        case "assigned":
          return left.users.length - right.users.length;
        case "customer":
          return (left.customer?.name ?? "").localeCompare(
            right.customer?.name ?? "",
          );
        case "name":
          return left.name.localeCompare(right.name);
        case "tags":
          return left.tags.length - right.tags.length;
        default:
          return left.createdAt.localeCompare(right.createdAt);
      }
    })();

    if (compare !== 0) {
      return isAscending ? compare : -compare;
    }

    return right.createdAt.localeCompare(left.createdAt);
  });

  return ordered;
}
