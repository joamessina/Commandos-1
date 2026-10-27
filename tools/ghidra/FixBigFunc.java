import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.*;
import ghidra.program.model.listing.Function;
import ghidra.app.cmd.disassemble.DisassembleCommand;
import ghidra.app.cmd.function.CreateFunctionCmd;

/** Rehace una función cuyo cuerpo Ghidra cortó antes de tiempo.
 *  Uso: -postScript FixBigFunc.java <entradaHex> <finExclusivoHex> */
public class FixBigFunc extends GhidraScript {
    @Override
    public void run() throws Exception {
        long entry = Long.parseLong(getScriptArgs()[0], 16), end = Long.parseLong(getScriptArgs()[1], 16);
        Address a0 = toAddr(entry), a1 = toAddr(end - 1);
        Function old = getFunctionAt(a0);
        if (old != null) removeFunction(old);
        AddressSet body = new AddressSet(a0, a1);
        clearListing(body);                                   // borra desensamblado desalineado
        boolean ok = new DisassembleCommand(a0, body, true).applyTo(currentProgram, monitor);
        println("desensamblado lineal: " + ok);
        Function f = createFunction(a0, null);
        if (f == null || !f.getBody().contains(a1)) {
            if (f != null) removeFunction(f);
            CreateFunctionCmd c = new CreateFunctionCmd(null, a0, body, ghidra.program.model.symbol.SourceType.USER_DEFINED);
            println("createFunction con cuerpo explícito: " + c.applyTo(currentProgram, monitor));
            f = getFunctionAt(a0);
        }
        println("función " + (f == null ? "NULL" : f.getName() + " tamaño " + f.getBody().getNumAddresses()));
    }
}
