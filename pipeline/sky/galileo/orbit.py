"""TLE → положення супутника (SPEC §7.7). Без залежностей: SGP4 (Hoots & Roehrich, Spacetrack Report #3;
Vallado 2006) — секулярні збурення J2/J4, довгоперіодичні J3 і короткоперіодичні J2, без атмосферного гальмування.

`assumption`: для орбіт Galileo (період ≈ 14 год) повний SDP4 додає ще місячно-сонячні збурення; тут їх нема.
Похибку перевіряє F2-AC1 (порівняння зі skyfield, допуск 0.1). Розраховано на свіжі TLE (до кількох діб).
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

# WGS-72, як у SGP4
RE_KM = 6378.135
MU = 398600.8
XKE = 60.0 / math.sqrt(RE_KM**3 / MU)
J2 = 0.001082616
J3 = -0.00000253881
J4 = -0.00000165597
TWO_PI = 2 * math.pi


@dataclass
class Sat:
    name: str
    epoch: datetime
    inc: float  # рад
    raan: float
    ecc: float
    argp: float
    m0: float
    n0: float  # рад/хв (Kozai, як у TLE)

    def __post_init__(self) -> None:
        cosio, sinio = math.cos(self.inc), math.sin(self.inc)
        th2 = cosio * cosio
        beta2 = 1 - self.ecc * self.ecc
        beta = math.sqrt(beta2)
        # відновлення середнього руху й піввісі за Брауером
        ak = (XKE / self.n0) ** (2 / 3)
        d1 = 0.75 * J2 * (3 * th2 - 1) / (beta * beta2)
        dl = d1 / (ak * ak)
        adel = ak * (1 - dl * dl - dl * (1 / 3 + 134 * dl * dl / 81))
        dl = d1 / (adel * adel)
        self.n = self.n0 / (1 + dl)
        self.a = (XKE / self.n) ** (2 / 3)  # у радіусах Землі
        pinvsq = 1 / (self.a * self.a * beta2 * beta2)
        t1 = 1.5 * J2 * pinvsq * self.n
        t2 = 0.5 * t1 * J2 * pinvsq
        t3 = -0.46875 * J4 * pinvsq * pinvsq * self.n
        self.con41 = 3 * th2 - 1
        self.mdot = self.n + 0.5 * t1 * beta * self.con41 + 0.0625 * t2 * beta * (13 - 78 * th2 + 137 * th2 * th2)
        self.argpdot = (
            -0.5 * t1 * (1 - 5 * th2)
            + 0.0625 * t2 * (7 - 114 * th2 + 395 * th2 * th2)
            + t3 * (3 - 36 * th2 + 49 * th2 * th2)
        )
        self.nodedot = -t1 * cosio + (0.5 * t2 * (4 - 19 * th2) + 2 * t3 * (3 - 7 * th2)) * cosio
        j3oj2 = J3 / J2
        self.aycof = -0.5 * j3oj2 * sinio
        den = 1 + cosio if abs(1 + cosio) > 1.5e-12 else 1.5e-12
        self.xlcof = -0.25 * j3oj2 * sinio * (3 + 5 * cosio) / den
        self.cosio, self.sinio, self.th2 = cosio, sinio, th2

    def teme_km(self, when: datetime) -> tuple[float, float, float]:
        """Положення в системі TEME, км."""
        t = (when - self.epoch).total_seconds() / 60
        mp = self.m0 + self.mdot * t
        argp = self.argp + self.argpdot * t
        node = self.raan + self.nodedot * t
        am, em = self.a, self.ecc
        axnl = em * math.cos(argp)
        temp = 1 / (am * (1 - em * em))
        aynl = em * math.sin(argp) + temp * self.aycof
        xl = mp + argp + node + temp * self.xlcof * axnl
        u = (xl - node) % TWO_PI
        eo1 = u
        for _ in range(10):
            s, c = math.sin(eo1), math.cos(eo1)
            step = (u - aynl * c + axnl * s - eo1) / (1 - c * axnl - s * aynl)
            step = max(-0.95, min(0.95, step))
            eo1 += step
            if abs(step) < 1e-12:
                break
        s, c = math.sin(eo1), math.cos(eo1)
        ecose = axnl * c + aynl * s
        esine = axnl * s - aynl * c
        el2 = axnl * axnl + aynl * aynl
        pl = am * (1 - el2)
        rl = am * (1 - ecose)
        betal = math.sqrt(1 - el2)
        temp = esine / (1 + betal)
        sinu = am / rl * (s - aynl - axnl * temp)
        cosu = am / rl * (c - axnl + aynl * temp)
        su = math.atan2(sinu, cosu)
        sin2u, cos2u = 2 * cosu * sinu, 1 - 2 * sinu * sinu
        temp1 = 0.5 * J2 / pl
        temp2 = temp1 / pl
        mrt = rl * (1 - 1.5 * temp2 * betal * self.con41) + 0.5 * temp1 * (1 - self.th2) * cos2u
        su -= 0.25 * temp2 * (7 * self.th2 - 1) * sin2u
        xnode = node + 1.5 * temp2 * self.cosio * sin2u
        xinc = self.inc + 1.5 * temp2 * self.cosio * self.sinio * cos2u
        ss, cs = math.sin(su), math.cos(su)
        sn, cn = math.sin(xnode), math.cos(xnode)
        si, ci = math.sin(xinc), math.cos(xinc)
        r = mrt * RE_KM
        return r * (-sn * ci * ss + cn * cs), r * (cn * ci * ss + sn * cs), r * si * ss


def _epoch(field: str) -> datetime:
    yy, day = int(field[:2]), float(field[2:])
    year = 2000 + yy if yy < 57 else 1900 + yy
    return datetime(year, 1, 1, tzinfo=UTC) + timedelta(days=day - 1)


def parse_tle(text: str) -> list[Sat]:
    """Формат Celestrak `FORMAT=tle`: назва + два рядки. Битий запис пропускається."""
    lines = [ln.rstrip() for ln in text.splitlines() if ln.strip()]
    sats: list[Sat] = []
    for i in range(len(lines) - 2):
        name, l1, l2 = lines[i], lines[i + 1], lines[i + 2]
        if not (l1.startswith("1 ") and l2.startswith("2 ")) or name.startswith(("1 ", "2 ")):
            continue
        try:
            sats.append(
                Sat(
                    name=name.strip(),
                    epoch=_epoch(l1[18:32]),
                    inc=math.radians(float(l2[8:16])),
                    raan=math.radians(float(l2[17:25])),
                    ecc=float("0." + l2[26:33].strip()),
                    argp=math.radians(float(l2[34:42])),
                    m0=math.radians(float(l2[43:51])),
                    n0=float(l2[52:63]) * TWO_PI / 1440,
                )
            )
        except ValueError:
            continue
    return sats


def gmst(when: datetime) -> float:
    """Середній зоряний час Гринвіча (IAU-82, як у SGP4/TEME), рад. UT1 ≈ UTC."""
    jd = (when - datetime(2000, 1, 1, 12, tzinfo=UTC)).total_seconds() / 86400
    tut1 = jd / 36525
    sec = -6.2e-6 * tut1**3 + 0.093104 * tut1**2 + (876600 * 3600 + 8640184.812866) * tut1 + 67310.54841
    return (sec % 86400) / 86400 * TWO_PI


def ecef_km(sat: Sat, when: datetime) -> tuple[float, float, float]:
    """TEME → земна система (обертання на GMST; рух полюсів не враховано)."""
    x, y, z = sat.teme_km(when)
    g = gmst(when)
    c, s = math.cos(g), math.sin(g)
    return c * x + s * y, -s * x + c * y, z
