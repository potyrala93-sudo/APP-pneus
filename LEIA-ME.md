# Estoque de Pneus — como colocar no ar

Usa o mesmo Supabase dos outros apps. Sem login: quem tiver o link abre direto.

1. **Banco (uma vez):** Supabase › SQL Editor › New query › cole `supabase/pneus.sql` › **Run**.
   Já vêm algumas medidas comuns; as outras você cadastra no próprio app.
2. **GitHub:** crie o repositório **APP-pneus** (Public) › *uploading an existing file* › envie
   `index.html`, `app.js`, `styles.css`, `config.js`, `manifest.webmanifest` e a pasta `icons`
   (não precisa da pasta `supabase`) › Commit changes › Settings › Pages › main / (root) › Save.
3. Link: https://potyrala93-sudo.github.io/APP-pneus/ (também abre pelo menu).

Movimentações no Supabase: visão **vw_pneu_movimentos** (com veículo, tipo, medida, destino e quem pegou).
Saldo: visão **vw_pneu_estoque**.
