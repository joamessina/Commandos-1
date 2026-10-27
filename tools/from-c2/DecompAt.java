import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;
import java.io.*;
import java.nio.file.*;
import java.util.*;

/** Uso: -postScript DecompAt.java <archivo con direcciones hex, una por línea> <archivo de salida> */
public class DecompAt extends GhidraScript {
    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        List<String> lines = Files.readAllLines(Paths.get(args[0]));
        DecompInterface di = new DecompInterface();
        di.openProgram(currentProgram);
        try (PrintWriter out = new PrintWriter(new OutputStreamWriter(new FileOutputStream(args[1]), "UTF-8"))) {
            for (String l : lines) {
                l = l.trim();
                if (l.isEmpty() || l.startsWith("#")) continue;
                String[] parts = l.split("\\s+");
                Address a = toAddr(Long.parseLong(parts[0].replace("0x", ""), 16));
                Function f = getFunctionContaining(a);
                if (f == null) f = createFunction(a, null);
                out.println("//// " + l + " -> " + (f == null ? "NO FUNCTION" : f.getName() + " @ " + f.getEntryPoint() + " size " + f.getBody().getNumAddresses()));
                if (f == null) continue;
                DecompileResults r = di.decompileFunction(f, 120, monitor);
                if (r.decompileCompleted()) out.println(r.getDecompiledFunction().getC());
                else out.println("// decompile failed: " + r.getErrorMessage());
            }
        }
    }
}
