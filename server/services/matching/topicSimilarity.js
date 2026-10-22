/**
 * StudySync AI — Topic Understanding & Similarity Engine (Phase 9)
 * 
 * Provides canonical taxonomy mapping, normalized text similarity,
 * alias resolution, and domain-level disambiguation.
 * 
 * Guaranteed free, zero external dependencies, deterministic, and explainable.
 */

// Canonical taxonomy covering core curriculum subjects and their sub-disciplines
export const TOPIC_TAXONOMY = [
  {
    id: 'topic-dbms',
    canonicalName: 'DBMS — Normalisation',
    subject: 'Database Systems',
    category: 'relational_theory',
    aliases: [
      'normalisation',
      'normalization',
      '1nf',
      '2nf',
      '3nf',
      'bcnf',
      'functional dependency',
      'functional dependencies',
      'lossless join',
      'decomposition',
      'minimal cover',
      'closure',
      'dependency preservation',
      'multivalued dependency',
      '4nf',
      'boyce codd',
    ],
  },
  {
    id: 'topic-dbms-joins',
    canonicalName: 'Relational Algebra & SQL Joins',
    subject: 'Database Systems',
    category: 'relational_querying',
    aliases: [
      'sql joins',
      'database joins',
      'inner join',
      'outer join',
      'left join',
      'right join',
      'natural join',
      'cross join',
      'relational algebra',
      'cartesian product',
      'hash join',
      'merge join',
      'nested loop join',
    ],
  },
  {
    id: 'topic-dbms-transactions',
    canonicalName: 'Transactions & ACID Concurrency',
    subject: 'Database Systems',
    category: 'concurrency_transactions',
    aliases: [
      'transactions',
      'acid',
      'concurrency control',
      'serializability',
      '2pl',
      'two phase locking',
      'deadlock in dbms',
      'wal',
      'write ahead logging',
      'isolation levels',
      'dirty read',
      'phantom read',
    ],
  },
  {
    id: 'topic-dbms-indexing',
    canonicalName: 'Indexing & Storage',
    subject: 'Database Systems',
    category: 'storage_indexing',
    aliases: [
      'indexing',
      'b+ tree',
      'b tree',
      'b-tree',
      'b+tree',
      'hash index',
      'query execution plan',
      'index scan',
      'clustered index',
      'non-clustered index',
    ],
  },
  {
    id: 'topic-dp',
    canonicalName: 'Dynamic Programming',
    subject: 'Algorithms & Complexity',
    category: 'algorithm_paradigms',
    aliases: [
      'dynamic programming',
      'dp',
      'memoization',
      'tabulation',
      'optimal substructure',
      'overlapping subproblems',
      'lcs',
      'longest common subsequence',
      'knapsack',
      'coin change',
      'matrix chain multiplication',
      'state reduction',
      'recurrence relations',
    ],
  },
  {
    id: 'topic-graphs',
    canonicalName: 'Graph Algorithms',
    subject: 'Algorithms & Complexity',
    category: 'graph_theory',
    aliases: [
      'graph algorithms',
      'bfs',
      'dfs',
      'breadth first search',
      'depth first search',
      'dijkstra',
      'shortest path',
      'topological sort',
      'minimum spanning tree',
      'mst',
      'kruskal',
      'prim',
      'bellman ford',
      'floyd warshall',
      'cycle detection',
    ],
  },
  {
    id: 'topic-os',
    canonicalName: 'Operating Systems — Deadlocks',
    subject: 'Operating Systems',
    category: 'os_synchronization',
    aliases: [
      'deadlocks',
      'deadlock',
      'coffman conditions',
      'banker’s algorithm',
      'bankers algorithm',
      'resource allocation graph',
      'safety state',
      'deadlock prevention',
      'deadlock avoidance',
      'circular wait',
      'hold and wait',
      'mutual exclusion',
    ],
  },
  {
    id: 'topic-os-memory',
    canonicalName: 'Virtual Memory & Page Replacement',
    subject: 'Operating Systems',
    category: 'os_memory',
    aliases: [
      'virtual memory',
      'page replacement',
      'paging',
      'lru',
      'least recently used',
      'fifo',
      'optimal page replacement',
      'tlb',
      'page fault',
      'frame allocation',
      'thrashing',
      'second chance algorithm',
    ],
  },
  {
    id: 'topic-linalg',
    canonicalName: 'Linear Algebra — Eigenvalues',
    subject: 'Mathematics',
    category: 'linear_algebra',
    aliases: [
      'eigenvalues',
      'eigenvectors',
      'diagonalization',
      'matrix diagonalization',
      'characteristic equation',
      'characteristic polynomial',
      'eigenspaces',
      'spectral theorem',
      'algebraic multiplicity',
      'geometric multiplicity',
    ],
  },
  {
    id: 'topic-net',
    canonicalName: 'Computer Networks — TCP/IP',
    subject: 'Computer Networks',
    category: 'transport_layer',
    aliases: [
      'tcp/ip',
      'tcp',
      'congestion control',
      'aimd',
      'additive increase multiplicative decrease',
      'slow start',
      'fast recovery',
      'fast retransmit',
      'sliding window',
      '3-way handshake',
      'flow control',
      'tcp tahoe',
      'tcp reno',
      'ssthresh',
    ],
  },
  {
    id: 'topic-ml',
    canonicalName: 'Machine Learning — Gradient Descent',
    subject: 'Machine Learning',
    category: 'ml_optimization',
    aliases: [
      'gradient descent',
      'cost function',
      'stochastic gradient descent',
      'sgd',
      'batch gradient descent',
      'mini-batch gradient descent',
      'learning rate',
      'convergence',
      'loss function',
      'backpropagation',
    ],
  },
];

const STOP_WORDS = new Set([
  'and',
  'or',
  'the',
  'a',
  'an',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'vs',
  'versus',
  'from',
  'is',
]);

/**
 * Normalizes text for comparison by lowercasing, stripping punctuation, and removing noise words.
 */
export function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts meaningful keyword tokens from a string.
 */
export function extractTokens(text) {
  const norm = normalizeText(text);
  if (!norm) return [];
  return norm
    .split(' ')
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

/**
 * Finds the closest matching taxonomy node for a given text or topic name.
 */
export function findTaxonomyNode(topicInput) {
  if (!topicInput || typeof topicInput !== 'string') return null;

  const norm = normalizeText(topicInput);
  if (!norm) return null;

  // 1. Direct ID or Canonical name match
  for (const node of TOPIC_TAXONOMY) {
    if (node.id === topicInput) return node;
    const normCanonical = normalizeText(node.canonicalName);
    if (norm === normCanonical || norm.includes(normCanonical) || normCanonical.includes(norm)) {
      return node;
    }
  }

  // 2. Alias match
  for (const node of TOPIC_TAXONOMY) {
    for (const alias of node.aliases) {
      const normAlias = normalizeText(alias);
      if (norm === normAlias || norm.includes(normAlias) || normAlias.includes(norm)) {
        return node;
      }
    }
  }

  // 3. Token-based overlap with aliases
  const inputTokens = new Set(extractTokens(topicInput));
  let bestNode = null;
  let maxShared = 0;

  for (const node of TOPIC_TAXONOMY) {
    let sharedCount = 0;
    for (const alias of node.aliases) {
      const aliasTokens = extractTokens(alias);
      for (const t of aliasTokens) {
        if (inputTokens.has(t)) sharedCount++;
      }
    }
    if (sharedCount > maxShared) {
      maxShared = sharedCount;
      bestNode = node;
    }
  }

  return maxShared >= 2 ? bestNode : null;
}

/**
 * Computes semantic similarity between two topics.
 * Returns { score: number (0.0 to 1.0), reason: string, level: string }
 */
export function calculateTopicSimilarity(topicA, topicB, subjectA = null, subjectB = null) {
  if (!topicA || !topicB) {
    // If only subjects are known, return subject domain baseline
    if (subjectA && subjectB && normalizeText(subjectA) === normalizeText(subjectB)) {
      return {
        score: 0.35,
        level: 'subject_only',
        reason: `Both focus on the general subject domain of ${subjectA}`,
      };
    }
    return { score: 0.0, level: 'none', reason: 'Unrelated topics' };
  }

  const normA = normalizeText(topicA);
  const normB = normalizeText(topicB);

  // 1. Exact string match
  if (normA === normB) {
    return {
      score: 1.0,
      level: 'exact',
      reason: `Exact topic match: "${topicA}"`,
    };
  }

  // 2. Taxonomy node resolution
  const nodeA = findTaxonomyNode(topicA);
  const nodeB = findTaxonomyNode(topicB);

  if (nodeA && nodeB) {
    // Both mapped to the EXACT same canonical topic (e.g. "SQL Joins" vs "Database Joins", or "1NF" vs "Normalisation")
    if (nodeA.id === nodeB.id) {
      return {
        score: 0.92,
        level: 'canonical_equivalent',
        reason: `Closely related concepts under ${nodeA.canonicalName}`,
      };
    }

    // Same category within subject (e.g. relational theory)
    if (nodeA.subject === nodeB.subject && nodeA.category === nodeB.category) {
      return {
        score: 0.75,
        level: 'same_category',
        reason: `Closely related areas in ${nodeA.subject}`,
      };
    }

    // Same broad subject, but distinctly different sub-topics (e.g. "SQL joins" vs "B+ Tree Indexing")
    // Prevents over-matching unrelated subtopics in the same subject
    if (nodeA.subject === nodeB.subject) {
      return {
        score: 0.28,
        level: 'same_subject_distinct_topics',
        reason: `Both belong to ${nodeA.subject}, but focus on distinct sub-topics (${nodeA.canonicalName} vs ${nodeB.canonicalName})`,
      };
    }

    // Different subjects entirely
    return {
      score: 0.05,
      level: 'different_subjects',
      reason: `Different subject areas (${nodeA.subject} vs ${nodeB.subject})`,
    };
  }

  // 3. Fallback: Token Jaccard overlap
  const tokensA = new Set(extractTokens(topicA));
  const tokensB = new Set(extractTokens(topicB));

  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }

  const unionSize = new Set([...tokensA, ...tokensB]).size;
  const jaccard = unionSize > 0 ? intersection / unionSize : 0;

  if (jaccard >= 0.5) {
    return {
      score: Math.min(0.85, 0.4 + jaccard * 0.5),
      level: 'token_overlap_high',
      reason: `High concept term overlap between "${topicA}" and "${topicB}"`,
    };
  }

  if (jaccard > 0.2) {
    return {
      score: Math.min(0.65, 0.2 + jaccard * 0.5),
      level: 'token_overlap_partial',
      reason: `Partial term overlap between "${topicA}" and "${topicB}"`,
    };
  }

  // 4. Same subject check if subjects provided
  if (subjectA && subjectB && normalizeText(subjectA) === normalizeText(subjectB)) {
    return {
      score: 0.25,
      level: 'same_subject_only',
      reason: `Same academic subject (${subjectA}), though target topics differ`,
    };
  }

  return {
    score: 0.0,
    level: 'none',
    reason: `Different topics: "${topicA}" and "${topicB}"`,
  };
}

export default {
  TOPIC_TAXONOMY,
  normalizeText,
  extractTokens,
  findTaxonomyNode,
  calculateTopicSimilarity,
};
