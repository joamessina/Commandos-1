import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;
import java.nio.file.*;
import java.util.*;

/** Crea funciones en regiones de código que el análisis automático no descubrió.
 *  Uso: -postScript CreateGapFuncs.java <archivo "inicioHex tamaño"> */
public class CreateGapFuncs extends GhidraScript {
    @Override
    public void run() throws Exception {
        List<String> lines = Files.readAllLines(Paths.get(getScriptArgs()[0]));
        int created = 0, regions = 0, fails = 0;
        for (String l : lines) {
            String[] p = l.trim().split("\\s+");
            if (p.length < 2) continue;
            long start = Long.parseLong(p[0], 16), end = start + Long.parseLong(p[1]);
            regions++;
            long a = start;
            int guard = 0;
            while (a < end && guard++ < 400) {
                Address ad = toAddr(a);
                Function in = getFunctionContaining(ad);
                if (in != null) { a = in.getBody().getMaxAddress().getOffset() + 1; continue; }
                int b = getByte(ad) & 0xff;
                if (b == 0xcc || b == 0x00 || b == 0x90) { a++; continue; }
                disassemble(ad);
                Function f = createFunction(ad, null);
                if (f == null) { fails++; a++; continue; }
                created++;
                a = f.getBody().getMaxAddress().getOffset() + 1;
            }
        }
        println("regiones " + regions + " funciones nuevas " + created + " fallos " + fails);
    }
}
