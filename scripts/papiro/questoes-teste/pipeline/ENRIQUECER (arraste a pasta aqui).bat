@echo off
chcp 65001 >nul
setlocal
title PAPIRO - Enriquecedor (Rani x cursinho)

set "PIPELINE=D:\meta novo\Metav2\scripts\papiro\questoes-teste\pipeline"
cd /d "%PIPELINE%"

echo ============================================================
echo  PAPIRO - Enriquecedor (Rani x cursinho)
echo ============================================================
echo.

if "%~1"=="" (
  rem  Duplo-clique: abre o menu interativo (escolhe a folha por numero).
  python enriquecer.py
) else (
  rem  Pasta arrastada em cima do .bat: roda direto nela.
  echo  Pasta: %~1
  echo.
  python enriquecer.py "%~1"
)

echo.
echo ------------------------------------------------------------
echo  Terminou. O RESUMO-FINAL.md fica na propria pasta.
echo ------------------------------------------------------------
pause
