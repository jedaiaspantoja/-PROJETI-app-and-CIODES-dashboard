# Banco de Dados Projeti

O novo banco oficial do projeto esta descrito no ERD `erd_projeti.pdf` e foi materializado em:

- `projeti_schema_v1_1.sql`: schema PostgreSQL/Supabase.
- `projeti_schema_v1_1_sqlite.sql`: schema offline SQLite equivalente.

## Tabelas do ERD v1.1

- `usuarios`
- `tipos_ocorrencia`
- `ocorrencias`
- `midia`
- `sincronizacao_offline`

## Impacto no codigo atual

O app atual ainda usa nomes e entidades do schema antigo:

- `users` -> `usuarios`
- `tipo_oco` -> `tipos_ocorrencia`
- `inf_oco` -> `ocorrencias`
- `inf_oco_midia` -> `midia`

O ERD v1.1 nao possui equivalentes para alguns recursos que existem no app atual:

- `tipo_vitim`
- `tutoriais`
- `tutorial_steps`
- `guarnicao`
- `guarnicao_membros`
- `inf_oco_status_log`
- `localizacao` como tabela separada

Por isso a troca completa precisa ser feita em uma migracao de codigo, nao apenas trocando o banco. Se o ERD v1.1 for definitivo, as telas de tutorial, tipo de vitima, guarnicao e historico precisam ser removidas, simplificadas ou o ERD precisa ganhar essas tabelas.

