@echo off
set "JAVA_HOME=C:\Program Files\Java\jdk-21"
set "PATH=%JAVA_HOME%\bin;%PATH%"
set GHIDRA_MAXMEM=8G
call "D:\Joaquin\tools\ghidra_12.1.4_PUBLIC\support\analyzeHeadless.bat" "D:\Joaquin\research-c1\ghidra" proj -process Comman1.exe -noanalysis -scriptPath "D:\Joaquin\research-c1\ghidra\scripts" -postScript CreateGapFuncs.java "D:\Joaquin\research-c1\gaps_code.txt"
echo GAPS_EXIT %ERRORLEVEL%
call "D:\Joaquin\tools\ghidra_12.1.4_PUBLIC\support\analyzeHeadless.bat" "D:\Joaquin\research-c1\ghidra" proj -process Comman1.exe -noanalysis -readOnly -scriptPath "D:\Joaquin\research-c1\ghidra\scripts" -postScript DecompAll.java "D:\Joaquin\research-c1\ghidra\all2" 6
echo DECOMP_EXIT %ERRORLEVEL%
