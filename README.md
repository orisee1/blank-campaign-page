# Central de Campanha

Central operacional offline-first para uma campanha de Deputada Estadual. A aplicação reúne pessoas, demandas, tarefas, agenda, eventos, equipe, território, documentos, despesas auxiliares, lembretes, relatórios, privacidade, auditoria, usuários e permissões.

## Estado desta entrega

A versão Web é uma PWA responsiva preparada para GitHub Pages. Os dados persistem em IndexedDB e as alterações entram em uma fila de sincronização. A interface não contém números fictícios: os indicadores partem dos registros reais.

Também estão incluídos:

- backend Cloudflare Worker + D1 com autenticação, sessões, bloqueio de tentativas, autorização no servidor, esquema relacional, auditoria e sincronização com detecção de conflito;
- wrapper Electron seguro e configuração para gerar instalador NSIS no Windows;
- workflow de publicação automática no GitHub Pages;
- exportação XLSX e PDF de verdade;
- importação XLSX/CSV com prévia e bloqueio de duplicados;
- testes de permissões e escopo.

> O GitHub Pages hospeda apenas arquivos estáticos. Para produção multiusuário, autenticação e sincronização reais, publique o backend de `server/` e configure `VITE_API_URL`. Sem isso, o Pages funciona como dispositivo local offline, mas não deve ser tratado como implantação multiusuário segura.

## Acesso inicial

O bootstrap solicitado cria o Administrador Master `admin19`. A senha inicial nunca é armazenada em texto puro: o repositório contém somente salt e hash PBKDF2-SHA-256. Troque a senha no primeiro acesso e no backend antes de inserir dados reais.

## Desenvolvimento Web

```bash
npm install
npm run dev
npm test
npm run build
```

## Backend de produção

1. Crie um banco D1.
2. Atualize `server/wrangler.toml` com o ID do banco e a origem Web permitida; o arquivo `.example` mantém uma referência limpa.
3. Execute o esquema em `server/schema.sql`.
4. Publique o Worker.
5. Configure `VITE_API_URL` no build do frontend.

```bash
cd server
npm install
npm run db:remote
npm run deploy
```

O backend usa cookie de sessão `HttpOnly`, `Secure` e `SameSite=None`, valida a origem permitida, verifica permissão no servidor e cria conflitos explícitos quando a versão recebida já ficou ultrapassada.

## GitHub Pages

O workflow `.github/workflows/pages.yml` executa o build e publica `dist/` a cada push em `main`. A aplicação usa o caminho base `/blank-campaign-page/` e navegação por hash para não gerar erros 404.

O repositório é privado. A disponibilidade de Pages para repositórios privados depende do plano e das políticas da conta GitHub. Se a ativação automática não for aceita pelo GitHub, habilite **Settings → Pages → GitHub Actions** uma única vez.

## Desktop

```bash
npm run electron
npm run desktop:dist
```

O Electron mantém `contextIsolation`, sandbox e `nodeIntegration` desativado no renderer. O build do instalador fica em `release/`.

## Arquitetura

```text
Web PWA / Electron
  ├─ interface React compartilhada
  ├─ IndexedDB: dados locais, anexos e fila
  ├─ Service Worker: shell offline
  └─ sincronização versionada
          │
          ▼
Cloudflare Worker
  ├─ autenticação e sessões
  ├─ autorização por função, permissão e escopo
  ├─ auditoria imutável pela interface comum
  └─ D1 relacional + conflitos de sincronização
```

## Segurança e privacidade

- não existe cadastro público;
- menus e rotas respeitam permissões;
- o backend não confia em função, campanha ou autoria enviadas pelo frontend;
- exclusões importantes são lógicas e restauráveis;
- exportações, downloads, logins e mudanças administrativas são auditados;
- dados de contato não são usados para perfilamento político;
- não existe disparo eleitoral em massa;
- o financeiro é identificado como auxiliar operacional, não substituto da prestação oficial;
- registros usam UUID e campos de versão, criação, atualização e exclusão.

Antes de uso eleitoral real, faça revisão jurídica/LGPD, teste de invasão, política de retenção, backup automatizado, configuração de domínio e armazenamento de anexos em R2.
