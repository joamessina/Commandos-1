@echo off
set "JAVA_HOME=C:\Program Files\Java\jdk-21"
set "PATH=%JAVA_HOME%\bin;%PATH%"
set GHIDRA_MAXMEM=8G
call "D:\Joaquin\tools\ghidra_12.1.4_PUBLIC\support\analyzeHeadless.bat" "D:\Joaquin\research\ghidra" proj -process Comm2.exe -noanalysis -readOnly -scriptPath "D:\Joaquin\research\ghidra\scripts" -postScript DecompAll.java "D:\Joaquin\research\ghidra\all" 6
