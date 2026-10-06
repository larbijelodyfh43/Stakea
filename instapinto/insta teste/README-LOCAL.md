# Simulação local com AnyAPI

Requer Node.js 22 ou superior. Na pasta do projeto, execute `npm start` e abra http://127.0.0.1:8000.

A chave está em `.env` (`ANYAPI_KEY=...`), lida somente pelo servidor. Não publique esse arquivo. Use este servidor em vez de Live Server ou `python -m http.server`, pois a interface precisa da rota `/api/profile` e os arquivos privados não devem ser servidos.

Digite um @ e confirme para exibir a foto, nome, bio e contagens públicas retornadas pela AnyAPI. O endpoint é `POST https://api.getanyapi.com/v1/run/instagram.profile`, com corpo `{ "handle": "nasa" }`. A resposta `output.data` é adaptada no arquivo `server.mjs`. Documentação: https://getanyapi.com/docs.

As consultas podem consumir saldo da AnyAPI. Há cache em memória por 15 minutos e compartilhamento de requisições simultâneas do mesmo perfil. Não há repetição automática de consultas com erro. O cache de fotos também fica em memória; após reiniciar o servidor, faça uma nova consulta para restaurar as fotos.

`js/demo.js` conecta a interface à consulta local e trata erros. A faixa amarela de simulação foi restaurada a pedido do dono. Feed, Direct e CTA usam preview-ui.js; o checkout é inteiramente simulado, sem cobrança. A foto e os dados públicos são reais; as animações de acesso, stories e conversas são fictícios. A cobrança PIX foi desativada. O servidor só escuta em 127.0.0.1 e bloqueia chamadas de navegador para serviços externos. Não se trata de acesso a contas privadas.

`npm test` valida adaptação dos dados, cache, erros, entrada inválida e bloqueio de acesso à chave, usando respostas simuladas sem consumir a API.


