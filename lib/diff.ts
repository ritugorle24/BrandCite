export interface DiffToken {
  type: 'equal' | 'added' | 'removed';
  value: string;
}

export interface DiffSummary {
  addedCount: number;
  removedCount: number;
  tokens: DiffToken[];
}

/**
 * Computes a word-and-whitespace level difference between two text versions
 * using Longest Common Subsequence (LCS).
 */
export function computeSimpleDiff(oldText: string, newText: string): DiffSummary {
  if (oldText === newText) {
    return {
      addedCount: 0,
      removedCount: 0,
      tokens: [{ type: 'equal', value: oldText }],
    };
  }

  // Tokenize preserving spaces
  const tokenize = (text: string): string[] => {
    return text.match(/\S+|\s+/g) || [];
  };

  const oldTokens = tokenize(oldText);
  const newTokens = tokenize(newText);

  const m = oldTokens.length;
  const n = newTokens.length;

  // DP table for LCS
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (oldTokens[i] === newTokens[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  // Backtrack to find diff
  const rawDiff: DiffToken[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldTokens[i - 1] === newTokens[j - 1]) {
      rawDiff.push({ type: 'equal', value: oldTokens[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rawDiff.push({ type: 'added', value: newTokens[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      rawDiff.push({ type: 'removed', value: oldTokens[i - 1] });
      i--;
    }
  }

  rawDiff.reverse();

  // Merge consecutive tokens of the same type for cleaner rendering
  const merged: DiffToken[] = [];
  let addedCount = 0;
  let removedCount = 0;

  for (const token of rawDiff) {
    if (token.type === 'added' && token.value.trim()) {
      addedCount++;
    } else if (token.type === 'removed' && token.value.trim()) {
      removedCount++;
    }

    if (merged.length > 0 && merged[merged.length - 1].type === token.type) {
      merged[merged.length - 1].value += token.value;
    } else {
      merged.push({ ...token });
    }
  }

  return {
    addedCount,
    removedCount,
    tokens: merged,
  };
}

