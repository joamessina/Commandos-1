@echo off
rem uso: decomp.cmd <archivo_direcciones> <salida.c>
set "JAVA_HOME=C:\Program Files\Java\jdk-21"
set "PATH=%JAVA_HOME%\bin;%PATH%"
set GHIDRA_MAXMEM=6G
call "D:\Joaquin\tools\ghidra_12.1.4_PUBLIC\support\analyzeHeadless.bat" "D:\Joaquin\research\ghidra" proj -process Comm2.exe -noanalysis -readOnly -scriptPath "D:\Joaquin\research\ghidra\scripts" -postScript DecompAt.java %1 %2
