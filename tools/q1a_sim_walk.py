"""Simulador del paso de caminata de C1 (motor + Sim peaton), 1D en linea recta.
Fuentes (coman_mp.exe): FUN_005DCF70/005D7D90 (motor, frenado d/ceil(d/v)), FUN_0066BB20 (v*=0.3, +impulso, mezcla 0.8/0.2),
FUN_00575F60 (v.n := max(v.n, |n|)), FUN_0066BCD0 (limitar), FUN_0057E6E0 (pos += v), FUN_00574200 (vprev = v al fin de ciclo).
uso: py -I tools/q1a_sim_walk.py
"""
import math

def step_sim(v, vprev, n):
    """un ciclo del Sim sobre el eje de avance. v,vprev,n escalares (n = Mover pedido, >=0)."""
    v *= 0.3                       # FUN_0066BB20
    if v * v < 0.01: v = 0.0
    if n * n > 1e-4 and v * n < n * n:   # FUN_00575F60 (empuje minimo a lo largo de n)
        v = n
    v = 0.8 * v + 0.2 * vprev      # FUN_005734A0
    if abs(v) < 0.001: v = 0.0
    return max(-10.0, min(v, 10.0))  # limitar: radio del cilindro (10)

def motor_speed(d, v, water=False):
    """velocidad pedida al Sim este ciclo (MotorAndante/Aliado, tramo recto a un punto)."""
    if d * d < 16 * v * v and v > 0.001:
        v = d / math.ceil(d / v)   # FUN_005049C0 = ceil (CRT 0x70C6D0), +0.1 y ftol no cambian el entero
    return v * (0.5 if water else 1.0)

def main():
    def sim(v_req, dist, tol2, water=False, maxc=400):
        pos = vprev = 0.0; log = []
        for c in range(maxc):
            d = dist - pos
            arrived = d * d < tol2
            n = 0.0 if arrived else math.copysign(motor_speed(abs(d), v_req, water), d)
            v = step_sim(vprev, vprev, n)   # v previo ya escalado dentro
            pos += v; vprev = v
            log.append((c, n, v, pos))
            if arrived and v == 0.0: break
        return log
    for name, v in (('anda 2.5', 2.5), ('corre Boina 6.0', 6.0), ('corre otros 5.0', 5.0), ('patrulla 1.7', 1.7)):
        lg = sim(v, 400.0, 4.0)
        print('==', name, ': primeros 6 ciclos (n pedido, v real):', [(round(n, 3), round(x, 3)) for _, n, x, _ in lg[:6]])
        reg = [x for _, n, x, _ in lg if abs(x - v) < 1e-6]
        print('   regimen estacionario:', reg[0] if reg else None, 'u/ciclo =', v * 20, 'u/s; ciclos hasta llegar:', len(lg), 'pos final', round(lg[-1][3], 3))
        tail = lg[-12:]
        print('   cola:', [(round(n, 2), round(x, 2), round(p, 2)) for _, n, x, p in tail])
    # sin frenado: deriva tras soltar
    pos = vprev = 0.0
    for c in range(40):
        v = step_sim(vprev, vprev, 2.5); pos += v; vprev = v
    p0 = pos; seq = []
    for c in range(12):
        v = step_sim(vprev, vprev, 0.0); pos += v; vprev = v; seq.append(round(v, 3))
    print('deriva tras soltar a 2.5:', seq, 'distancia extra', round(pos - p0, 3))
    # agua x0.5
    lg = sim(2.5, 200.0, 4.0, water=True)
    print('agua: regimen', round(lg[10][2], 4))

if __name__ == '__main__':
    main()
