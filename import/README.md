# Importação fiscal no container

Descompacte o backup nesta pasta, preservando `database.json` e `storage/fiscal-documents/`.

Na inicialização do backend, o importador:

- usa `database.json` e os registros da coleção `fiscaldocuments` como mapa `NF -> VP -> salesOrderId`;
- processa PDFs textuais com `pdftotext` e PDFs escaneados com Tesseract;
- copia os anexos para `backend/storage/fiscal-documents/<VP>`;
- atualiza somente NFs com vínculo confirmado;
- grava `fiscal-reconciliation-result.json` em `import/output`;
- marca baixa confiança ou divergências para revisão, sem alterar automaticamente a venda.

Para impedir a execução automática durante uma subida:

```text
FISCAL_IMPORT_ON_STARTUP=false
```

O arquivo `fiscal-reconciliation.json` é opcional e pode complementar o mapa do backup para NFs sem registro na coleção fiscal.
