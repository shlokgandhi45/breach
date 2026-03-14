"""
services/dsu/union_find.py

Core Disjoint-Set Union (DSU) data structure.
O(α·n) amortised per operation via path compression + union by rank.
"""

from typing import Dict, List


class UnionFind:
    def __init__(self, n: int):
        self.parent: List[int] = list(range(n))
        self.rank:   List[int] = [0] * n
        self.num_components: int = n

    def find(self, x: int) -> int:
        """Path compression — re-links every node directly to root."""
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])
        return self.parent[x]

    def union(self, x: int, y: int) -> bool:
        """Union by rank — always attaches smaller tree under larger."""
        rx, ry = self.find(x), self.find(y)
        if rx == ry:
            return False
        if self.rank[rx] < self.rank[ry]:
            self.parent[rx] = ry
        elif self.rank[rx] > self.rank[ry]:
            self.parent[ry] = rx
        else:
            self.parent[ry] = rx
            self.rank[rx] += 1
        self.num_components -= 1
        return True

    def connected(self, x: int, y: int) -> bool:
        return self.find(x) == self.find(y)

    def get_components(self) -> Dict[int, List[int]]:
        """Return {root_idx: [member_indices]} after all unions are done."""
        components: Dict[int, List[int]] = {}
        for node in range(len(self.parent)):
            root = self.find(node)
            components.setdefault(root, []).append(node)
        return components
