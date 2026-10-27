import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;
import ghidra.program.model.symbol.Symbol;
import ghidra.program.model.symbol.SymbolIterator;
import ghidra.program.model.mem.Memory;
import java.io.*;

/** Exporta cada vftable (clase::vftable) con las direcciones de sus métodos virtuales. Uso: -postScript ExportVtables.java <salida> */
public class ExportVtables extends GhidraScript {
    @Override
    public void run() throws Exception {
        String outPath = getScriptArgs()[0];
        Memory mem = currentProgram.getMemory();
        try (PrintWriter out = new PrintWriter(new OutputStreamWriter(new FileOutputStream(outPath), "UTF-8"))) {
            SymbolIterator it = currentProgram.getSymbolTable().getAllSymbols(true);
            int count = 0;
            while (it.hasNext()) {
                Symbol s = it.next();
                String name = s.getName();
                if (!name.contains("vftable")) continue;
                String ns = s.getParentNamespace().getName(true);
                StringBuilder sb = new StringBuilder();
                sb.append(ns).append("::").append(name).append(" @ ").append(s.getAddress()).append(" :");
                Address a = s.getAddress();
                for (int i = 0; i < 200; i++) {
                    try {
                        long v = mem.getInt(a.add(i * 4L)) & 0xffffffffL;
                        Address t = toAddr(v);
                        if (!mem.contains(t)) break;
                        Function f = getFunctionAt(t);
                        if (f == null) {
                            // fin de la tabla si hay otro símbolo en el siguiente slot
                            if (i > 0 && currentProgram.getSymbolTable().getPrimarySymbol(a.add(i * 4L)) != null) break;
                            if (!mem.getBlock(t).isExecute()) break;
                        }
                        sb.append(' ').append(Long.toHexString(v));
                    } catch (Exception e) {
                        break;
                    }
                    if (i > 0 && currentProgram.getSymbolTable().getPrimarySymbol(a.add((i + 1) * 4L)) != null) break;
                }
                out.println(sb);
                count++;
            }
            println("vtables: " + count);
        }
    }
}
