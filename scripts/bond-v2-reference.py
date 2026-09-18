"""Independent CP2 oracle: Decimal (70 digits), Newton in yield, no app imports.

Run with Python 3; only synthetic dated flows. The TypeScript tests use these
fixed results as well as an independent finite-difference price calculation.
"""
from decimal import Decimal as D, getcontext
from datetime import date
import json

getcontext().prec = 70

def reference(price, flows):
    price = D(str(price))
    flows = [(D(str(amount)), D(days) / D(365)) for amount, days in flows]
    y = D('0.05')
    for _ in range(500):
        pv = sum(cf / (1 + y) ** t for cf, t in flows)
        derivative = -sum(t * cf / (1 + y) ** (t + 1) for cf, t in flows)
        step = (pv - price) / derivative
        next_y = y - step
        if next_y <= -1:
            next_y = (y - 1) / 2
        if abs(next_y - y) < D('1e-60'):
            y = next_y
            break
        y = next_y
    mac = sum(t * cf / (1 + y) ** t for cf, t in flows) / price
    return {'yield': str(y), 'macaulay': str(mac), 'modified': str(mac / (1 + y)), 'dv01_100000': str(10 * mac / (1 + y))}

days = lambda a, b: (date.fromisoformat(b) - date.fromisoformat(a)).days
cases = {
    '365': (100, [(105, 365)]),
    '366': (100, [(105, 366)]),
    'annual_anchor': (100, [(5, 1), (105, 366)]),
    'semiannual': (100, [(2.5, 181), (102.5, 365)]),
    'zero730': (90, [(100, 730)]),
    'negative': (105, [(100, 365)]),
    'zero': (105, [(105, 365)]),
    'short_zero': (100.10, [(100, 5)]),
    'short_semi': ('102.93118208', [(103, 5)]),
    'short_annual': ('102.93118208', [(106, 5)]),
    'short225': (str(D('99.885') + D('2.25') * D(336) / D(365)), [(D('102.25'), 29)]),
}
print(json.dumps({name: reference(*args) for name, args in cases.items()}, indent=2))
