@echo off
set "JAVA_HOME=C:\Program Files\Java\jdk-21"
set "PATH=%JAVA_HOME%\bin;%PATH%"
set GHIDRA_MAXMEM=6G
call "D:\Joaquin\tools\ghidra_12.1.4_PUBLIC\support\analyzeHeadless.bat" "D:\Joaquin\research\ghidra" proj -import "D:\Joaquin\research\ghidra\Comm2.exe" -overwrite
echo EXIT %ERRORLEVEL%
