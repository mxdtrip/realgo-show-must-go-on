export type PlatformId = "leetcode" | "geeksforgeeks" | "hackerrank" | "codeforces";

// Первые 4 плейсхолдера площадок. LeetCode подключён полностью,
// GeeksforGeeks в процессе интеграции, HackerRank/Codeforces — задел на будущее.
// color = основной цвет бренда площадки (подсветка hover в онбординге).
export const platformOptions: ReadonlyArray<{ id: PlatformId; label: string; color: string }> = [
  { id: "leetcode", label: "LeetCode", color: "#ffa116" },
  { id: "geeksforgeeks", label: "GeeksforGeeks", color: "#2f8d46" },
  { id: "hackerrank", label: "HackerRank", color: "#00ea64" },
  { id: "codeforces", label: "Codeforces", color: "#318ce7" },
];
