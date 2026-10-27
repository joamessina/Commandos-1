import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.FunctionIterator;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;

/** Decompila todas las funciones en paralelo. Uso: -postScript DecompAll.java <carpeta salida> <hilos> */
public class DecompAll extends GhidraScript {
    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        Path outDir = Paths.get(args[0]);
        int threads = Integer.parseInt(args[1]);
        Files.createDirectories(outDir);
        List<Function> fns = new ArrayList<>();
        FunctionIterator it = currentProgram.getFunctionManager().getFunctions(true);
        while (it.hasNext()) fns.add(it.next());
        println("funciones: " + fns.size());
        ConcurrentSkipListMap<Long, String> results = new ConcurrentSkipListMap<>();
        ExecutorService ex = Executors.newFixedThreadPool(threads);
        ThreadLocal<DecompInterface> tl = ThreadLocal.withInitial(() -> {
            DecompInterface di = new DecompInterface();
            di.openProgram(currentProgram);
            return di;
        });
        List<Future<?>> fs = new ArrayList<>();
        final int[] done = {0};
        for (Function f : fns) {
            fs.add(ex.submit(() -> {
                String text;
                try {
                    DecompileResults r = tl.get().decompileFunction(f, 60, null);
                    text = r.decompileCompleted() ? r.getDecompiledFunction().getC() : "// decompile failed: " + r.getErrorMessage();
                } catch (Throwable t) {
                    text = "// exception " + t;
                }
                results.put(f.getEntryPoint().getOffset(), "//// " + f.getEntryPoint() + " " + f.getName() + " size " + f.getBody().getNumAddresses() + "\n" + text + "\n");
                synchronized (done) {
                    done[0]++;
                    if (done[0] % 500 == 0) println("hechas " + done[0]);
                }
            }));
        }
        for (Future<?> fu : fs) fu.get();
        ex.shutdown();
        // un archivo por bloque de 0x40000
        Map<Long, StringBuilder> chunks = new TreeMap<>();
        for (Map.Entry<Long, String> e : results.entrySet()) {
            long key = e.getKey() >> 18;
            chunks.computeIfAbsent(key, k -> new StringBuilder()).append(e.getValue());
        }
        for (Map.Entry<Long, StringBuilder> e : chunks.entrySet()) {
            Files.write(outDir.resolve(String.format("fn_%08x.c", e.getKey() << 18)), e.getValue().toString().getBytes("UTF-8"));
        }
        println("listo");
    }
}
