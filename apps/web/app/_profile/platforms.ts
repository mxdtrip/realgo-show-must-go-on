export type PlatformId = "leetcode" | "geeksforgeeks" | "hackerrank" | "codeforces";

// 4 площадки каталога. LeetCode и HackerRank — с адаптером submit-детекции в
// расширении (apps/extension/src/platforms); GeeksforGeeks/Codeforces уже
// выбираются здесь и в атласе, адаптер расширения для них следующий.
// color = основной цвет бренда площадки (подсветка hover в онбординге).
export const platformOptions: ReadonlyArray<{ id: PlatformId; label: string; color: string }> = [
  { id: "leetcode", label: "LeetCode", color: "#ffa116" },
  { id: "geeksforgeeks", label: "GeeksforGeeks", color: "#2f8d46" },
  { id: "hackerrank", label: "HackerRank", color: "#00ea64" },
  { id: "codeforces", label: "Codeforces", color: "#318ce7" },
];
