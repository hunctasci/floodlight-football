"""Camera-driven environments. Each builder makes only what cameras see and
returns anchors (named points) that shots stage against.

HNC ergonomics (adult: hips 0.715, shoulders 1.415, head top ~2.02, legs
0.67): furniture follows the body so nobody floats — seats 0.36, tables
0.68, counters 0.9, doors 2.45, ceilings 2.95.
"""

ERGO = dict(seat=0.36, sofa=0.36, table=0.68, counter=0.9, bed=0.46, door=2.45, ceiling=2.95, car_seat=0.3)
