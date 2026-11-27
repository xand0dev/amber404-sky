"""Геометрія спостерігача: висота супутника над горизонтом і PDOP лише по Galileo (SPEC §6.3, §7.7)."""

from __future__ import annotations

import math

# WGS-84
A_KM = 6378.137
F = 1 / 298.257223563
E2 = F * (2 - F)


def site_ecef_km(lat: float, lon: float, h_km: float = 0.0) -> tuple[float, float, float]:
    p, lam = math.radians(lat), math.radians(lon)
    n = A_KM / math.sqrt(1 - E2 * math.sin(p) ** 2)
    return (
        (n + h_km) * math.cos(p) * math.cos(lam),
        (n + h_km) * math.cos(p) * math.sin(lam),
        (n * (1 - E2) + h_km) * math.sin(p),
    )


def enu_unit(lat: float, lon: float, site: tuple, sat: tuple) -> tuple[float, float, float]:
    """Одиничний вектор на супутник у локальних осях (схід, північ, вгору)."""
    p, lam = math.radians(lat), math.radians(lon)
    dx, dy, dz = (sat[0] - site[0], sat[1] - site[1], sat[2] - site[2])
    r = math.sqrt(dx * dx + dy * dy + dz * dz)
    e = -math.sin(lam) * dx + math.cos(lam) * dy
    n = -math.sin(p) * math.cos(lam) * dx - math.sin(p) * math.sin(lam) * dy + math.cos(p) * dz
    u = math.cos(p) * math.cos(lam) * dx + math.cos(p) * math.sin(lam) * dy + math.sin(p) * dz
    return e / r, n / r, u / r


def elevation_deg(unit: tuple[float, float, float]) -> float:
    return math.degrees(math.asin(max(-1.0, min(1.0, unit[2]))))


def _inverse(m: list[list[float]]) -> list[list[float]] | None:
    n = len(m)
    a = [row[:] + [1.0 if i == j else 0.0 for j in range(n)] for i, row in enumerate(m)]
    for c in range(n):
        piv = max(range(c, n), key=lambda r: abs(a[r][c]))
        if abs(a[piv][c]) < 1e-12:
            return None
        a[c], a[piv] = a[piv], a[c]
        d = a[c][c]
        a[c] = [v / d for v in a[c]]
        for r in range(n):
            if r != c and a[r][c]:
                k = a[r][c]
                a[r] = [v - k * w for v, w in zip(a[r], a[c], strict=True)]
    return [row[n:] for row in a]


def pdop(units: list[tuple[float, float, float]]) -> float | None:
    """PDOP = sqrt(tr(Q)[x,y,z]), Q = (GᵀG)⁻¹, рядок G = [e, n, u, 1]. Менше 4 супутників → None."""
    if len(units) < 4:
        return None
    g = [[e, n, u, 1.0] for e, n, u in units]
    gtg = [[sum(row[i] * row[j] for row in g) for j in range(4)] for i in range(4)]
    q = _inverse(gtg)
    if q is None:
        return None
    return math.sqrt(q[0][0] + q[1][1] + q[2][2])
