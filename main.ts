// tiny-stack-vm entry: a faithful interpreter for make.fun's tiny stack ISA
// (kit: generator/subject/ISA.md), hard rules included: wrapping MUL, unsigned
// DIVU/MODU/LTU, per-trap exit codes, stack/call/memory/step/output bounds.
// IM/PO/PU: per-opcode immediate length, pops, pushes ('x' = unknown opcode).
import { mkdirSync as mk, readdirSync as ls, readFileSync as rf, writeFileSync as wf } from 'node:fs';
import { join as J } from 'node:path';
const IM = '01400000xxxxxxxx000000000000000x000xxxxxxxxxxxxx22220xxxxxxxxxxx00xxxxxxxxxxxxxx0000';
const PO = '00011223xxxxxxxx222222212221222x222xxxxxxxxxxxxx01100xxxxxxxxxxx12xxxxxxxxxxxxxx1101';
const PU = '01102233xxxxxxxx111111111111111x111xxxxxxxxxxxxx00000xxxxxxxxxxx10xxxxxxxxxxxxxx0010';
function run(p: Uint8Array, q: Uint8Array) {
  const n = p.length, D = new Int32Array(256), C = new Int32Array(64), M = new Int32Array(256), O = new Uint8Array(65536);
  let s = 0, c = 0, o = 0, i = 0, pc = 0, t = 0;
  const end = (e: number) => ({ out: O.slice(0, o), code: e });
  for (;;) {
    if (t === 1e6) return end(10);
    if (pc < 0 || pc >= n) return end(9);
    const op = p[pc], m = IM.charCodeAt(op);
    if (op > 83 || m === 120) return end(5);
    const im = m - 48;
    if (pc + im >= n) return end(9);
    t++;
    const po = PO.charCodeAt(op) - 48, pu = PU.charCodeAt(op) - 48;
    if (s < po) return end(2);
    if (s - po + pu > 256) return end(3);
    const x = pc + 1 + im; pc = x;
    switch (op) {
      case 0: return end(0);
      case 1: D[s++] = (p[x - 1] << 24) >> 24; break;
      case 2: D[s++] = p[x - 4] | p[x - 3] << 8 | p[x - 2] << 16 | p[x - 1] << 24; break;
      case 3: s--; break;
      case 4: D[s] = D[s - 1]; s++; break;
      case 5: { const v = D[s - 1]; D[s - 1] = D[s - 2]; D[s - 2] = v; break; }
      case 6: D[s] = D[s - 2]; s++; break;
      case 7: { const v = D[s - 3]; D[s - 3] = D[s - 2]; D[s - 2] = D[s - 1]; D[s - 1] = v; break; }
      case 23: D[s - 1] = -D[s - 1] | 0; break;
      case 27: D[s - 1] = ~D[s - 1]; break;
      case 48: case 49: case 50: {
        const r = ((p[x - 2] | p[x - 1] << 8) << 16) >> 16;
        let k = true;
        if (op !== 48) { const v = D[--s]; k = op === 49 ? v === 0 : v !== 0; }
        if (k) pc = x + r;
        break;
      }
      case 51: if (c === 64) return end(7); C[c++] = x; pc = p[x - 2] | p[x - 1] << 8; break;
      case 52: if (c === 0) return end(8); pc = C[--c]; break;
      case 64: { const a = D[s - 1]; if (a < 0 || a > 255) return end(6); D[s - 1] = M[a]; break; }
      case 65: { const a = D[s - 1], v = D[s - 2]; if (a < 0 || a > 255) return end(6); s -= 2; M[a] = v; break; }
      case 80: { const v = String(D[s - 1]); if (o + v.length > 65536) return end(11); s--; for (let j = 0; j < v.length; j++) O[o++] = v.charCodeAt(j); break; }
      case 81: if (o === 65536) return end(11); O[o++] = D[--s] & 255; break;
      case 82: D[s++] = i < q.length ? q[i++] : -1; break;
      case 83: return end(D[--s] & 255);
      default: {
        const b = D[s - 1], a = D[s - 2]; let r = 0;
        if (op === 16) r = a + b | 0;
        else if (op === 17) r = a - b | 0;
        else if (op === 18) r = Math.imul(a, b);
        else if (op === 19) { if (!b) return end(4); r = a === -2147483648 && b === -1 ? a : (a / b) | 0; }
        else if (op === 20) { if (!b) return end(4); r = b === -1 ? 0 : (a % b) | 0; }
        else if (op === 21) { if (!b) return end(4); r = Math.floor((a >>> 0) / (b >>> 0)) | 0; }
        else if (op === 22) { if (!b) return end(4); r = (a >>> 0) % (b >>> 0) | 0; }
        else if (op === 24) r = a & b;
        else if (op === 25) r = a | b;
        else if (op === 26) r = a ^ b;
        else if (op === 28) r = a << (b & 31);
        else if (op === 29) r = a >> (b & 31);
        else if (op === 30) r = a >>> (b & 31) | 0;
        else if (op === 32) r = a === b ? 1 : 0;
        else if (op === 33) r = a < b ? 1 : 0;
        else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
        s -= 2; D[s++] = r;
      }
    }
  }
}
const I = process.env.MAKEFUN_INPUT_DIR ?? '/input', W = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of ls(I).sort()) {
  const r = run(new Uint8Array(rf(J(I, id, 'program.bin'))), new Uint8Array(rf(J(I, id, 'input.bin'))));
  mk(J(W, id), { recursive: true });
  wf(J(W, id, 'stdout.bin'), r.out);
  wf(J(W, id, 'exit.txt'), r.code + '\n');
}
