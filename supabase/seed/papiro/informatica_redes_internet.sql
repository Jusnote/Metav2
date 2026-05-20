-- =====================================================================
-- PAPIRO seed — Informática → Redes e Internet
-- Gerado por scripts/papiro/generate-seed.ts a partir de:
-- Redes e Internet (versao_taxonomia: 2.0)
-- Total de temas: 22
-- Idempotente: rodar 2× = mesmo resultado.
-- =====================================================================

BEGIN;

-- ---------- 1. UPSERT disciplina ----------
INSERT INTO papiro.disciplina (nome, slug, ordem)
VALUES ('Informática', 'informatica', 0)
ON CONFLICT (slug) DO UPDATE SET
  nome = EXCLUDED.nome;

-- ---------- 2. UPSERT macro_area ----------
INSERT INTO papiro.macro_area (disciplina_id, nome, slug, ordem)
SELECT d.id, 'Redes e Internet', 'informatica.redes_internet', 0
FROM papiro.disciplina d WHERE d.slug = 'informatica'
ON CONFLICT (slug) DO UPDATE SET
  nome = EXCLUDED.nome;

-- ---------- 3. UPSERT temas (ordenados por ordem_curricular) ----------
-- [1] Fundamentos de Redes de Computadores
INSERT INTO papiro.tema (
  macro_area_id, slug_hierarquico, nome, descricao_breve,
  objetivo_pedagogico, ordem_curricular, tempo_estudo_min,
  profundidade_estrat, profundidade_gran,
  conceitos_principais, mapeamento_paginas
)
SELECT m.id,
  'informatica.redes_internet.fundamentos_redes',
  'Fundamentos de Redes de Computadores',
  'Conceitos-base de redes, enlace e métricas de transmissão.',
  'Estabelecer o vocabulário fundamental antes de qualquer aprofundamento.',
  1, 45,
  'alta', 'media',
  '["rede de computadores","enlace ponto-a-ponto","enlace ponto-multiponto","taxa de transferência","largura de banda"]'::jsonb,
  '{"estrategia":["3-11"],"gran":["7-9","199-200","230-232"]}'::jsonb
FROM papiro.macro_area m WHERE m.slug = 'informatica.redes_internet'
ON CONFLICT (slug_hierarquico) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao_breve = EXCLUDED.descricao_breve,
  objetivo_pedagogico = EXCLUDED.objetivo_pedagogico,
  ordem_curricular = EXCLUDED.ordem_curricular,
  tempo_estudo_min = EXCLUDED.tempo_estudo_min,
  profundidade_estrat = EXCLUDED.profundidade_estrat,
  profundidade_gran = EXCLUDED.profundidade_gran,
  conceitos_principais = EXCLUDED.conceitos_principais,
  mapeamento_paginas = EXCLUDED.mapeamento_paginas;

-- [2] Classificação de Redes (dimensão e arquitetura)
INSERT INTO papiro.tema (
  macro_area_id, slug_hierarquico, nome, descricao_breve,
  objetivo_pedagogico, ordem_curricular, tempo_estudo_min,
  profundidade_estrat, profundidade_gran,
  conceitos_principais, mapeamento_paginas
)
SELECT m.id,
  'informatica.redes_internet.classificacao_redes',
  'Classificação de Redes (dimensão e arquitetura)',
  'Classificação por alcance (PAN/LAN/MAN/WAN) e arquitetura.',
  'Permitir classificar qualquer rede apresentada em prova.',
  2, 35,
  'alta', 'media',
  '["PAN","LAN","MAN","WAN","arquitetura cliente/servidor","arquitetura ponto-a-ponto"]'::jsonb,
  '{"estrategia":["3-11"],"gran":["9","169-170","176","230-232"]}'::jsonb
FROM papiro.macro_area m WHERE m.slug = 'informatica.redes_internet'
ON CONFLICT (slug_hierarquico) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao_breve = EXCLUDED.descricao_breve,
  objetivo_pedagogico = EXCLUDED.objetivo_pedagogico,
  ordem_curricular = EXCLUDED.ordem_curricular,
  tempo_estudo_min = EXCLUDED.tempo_estudo_min,
  profundidade_estrat = EXCLUDED.profundidade_estrat,
  profundidade_gran = EXCLUDED.profundidade_gran,
  conceitos_principais = EXCLUDED.conceitos_principais,
  mapeamento_paginas = EXCLUDED.mapeamento_paginas;

-- [3] Topologias e Modos de Transmissão
INSERT INTO papiro.tema (
  macro_area_id, slug_hierarquico, nome, descricao_breve,
  objetivo_pedagogico, ordem_curricular, tempo_estudo_min,
  profundidade_estrat, profundidade_gran,
  conceitos_principais, mapeamento_paginas
)
SELECT m.id,
  'informatica.redes_internet.topologias_transmissao',
  'Topologias e Modos de Transmissão',
  'Topologias físicas/lógicas, modos de transmissão e comutação.',
  'Dominar como os dados trafegam e como a rede se organiza.',
  3, 40,
  'media', 'alta',
  '["topologia estrela/barramento/anel/malha","topologia lógica","simplex/half-duplex/full-duplex","unicast/multicast/broadcast","comutação por circuito/pacotes/células"]'::jsonb,
  '{"estrategia":["3-11"],"gran":["215-225"]}'::jsonb
FROM papiro.macro_area m WHERE m.slug = 'informatica.redes_internet'
ON CONFLICT (slug_hierarquico) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao_breve = EXCLUDED.descricao_breve,
  objetivo_pedagogico = EXCLUDED.objetivo_pedagogico,
  ordem_curricular = EXCLUDED.ordem_curricular,
  tempo_estudo_min = EXCLUDED.tempo_estudo_min,
  profundidade_estrat = EXCLUDED.profundidade_estrat,
  profundidade_gran = EXCLUDED.profundidade_gran,
  conceitos_principais = EXCLUDED.conceitos_principais,
  mapeamento_paginas = EXCLUDED.mapeamento_paginas;

-- [4] Meios de Transmissão e Equipamentos de Rede
INSERT INTO papiro.tema (
  macro_area_id, slug_hierarquico, nome, descricao_breve,
  objetivo_pedagogico, ordem_curricular, tempo_estudo_min,
  profundidade_estrat, profundidade_gran,
  conceitos_principais, mapeamento_paginas
)
SELECT m.id,
  'informatica.redes_internet.meios_equipamentos',
  'Meios de Transmissão e Equipamentos de Rede',
  'Meios guiados/não-guiados e equipamentos de interconexão.',
  'Reconhecer cada meio físico e equipamento, função e camada.',
  4, 50,
  'alta', 'alta',
  '["cabo coaxial","par trançado","fibra óptica","meio não-guiado","hub","switch","bridge","roteador","modem","placa de rede","repetidor"]'::jsonb,
  '{"estrategia":["12-19"],"gran":["203-214","226-233"]}'::jsonb
FROM papiro.macro_area m WHERE m.slug = 'informatica.redes_internet'
ON CONFLICT (slug_hierarquico) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao_breve = EXCLUDED.descricao_breve,
  objetivo_pedagogico = EXCLUDED.objetivo_pedagogico,
  ordem_curricular = EXCLUDED.ordem_curricular,
  tempo_estudo_min = EXCLUDED.tempo_estudo_min,
  profundidade_estrat = EXCLUDED.profundidade_estrat,
  profundidade_gran = EXCLUDED.profundidade_gran,
  conceitos_principais = EXCLUDED.conceitos_principais,
  mapeamento_paginas = EXCLUDED.mapeamento_paginas;

-- [5] Padrões de Rede e Wi-Fi (IEEE 802)
INSERT INTO papiro.tema (
  macro_area_id, slug_hierarquico, nome, descricao_breve,
  objetivo_pedagogico, ordem_curricular, tempo_estudo_min,
  profundidade_estrat, profundidade_gran,
  conceitos_principais, mapeamento_paginas
)
SELECT m.id,
  'informatica.redes_internet.padroes_wifi',
  'Padrões de Rede e Wi-Fi (IEEE 802)',
  'Comitê IEEE 802, padrão 802.11, modos e segurança Wi-Fi.',
  'Compreender a padronização das redes sem fio e sua segurança.',
  5, 45,
  'alta', 'media',
  '["IEEE 802","IEEE 802.11","Wi-Fi × Wireless","WEP/WPA/WPA2/WPA3","modo ad-hoc","modo infraestrutura","evolução b/a/g/n/ac/ax"]'::jsonb,
  '{"estrategia":["12-19"],"gran":["208-214"]}'::jsonb
FROM papiro.macro_area m WHERE m.slug = 'informatica.redes_internet'
ON CONFLICT (slug_hierarquico) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao_breve = EXCLUDED.descricao_breve,
  objetivo_pedagogico = EXCLUDED.objetivo_pedagogico,
  ordem_curricular = EXCLUDED.ordem_curricular,
  tempo_estudo_min = EXCLUDED.tempo_estudo_min,
  profundidade_estrat = EXCLUDED.profundidade_estrat,
  profundidade_gran = EXCLUDED.profundidade_gran,
  conceitos_principais = EXCLUDED.conceitos_principais,
  mapeamento_paginas = EXCLUDED.mapeamento_paginas;

-- [6] Internet: Origem, ARPANET e Funcionamento
INSERT INTO papiro.tema (
  macro_area_id, slug_hierarquico, nome, descricao_breve,
  objetivo_pedagogico, ordem_curricular, tempo_estudo_min,
  profundidade_estrat, profundidade_gran,
  conceitos_principais, mapeamento_paginas
)
SELECT m.id,
  'informatica.redes_internet.internet_origem_funcionamento',
  'Internet: Origem, ARPANET e Funcionamento',
  'História, ARPANET, backbone, hierarquia ISP e funcionamento.',
  'Entender origem e lógica estrutural da Internet antes dos serviços.',
  6, 40,
  'alta', 'alta',
  '["Guerra Fria","ARPA/ARPANET","backbone","provedores ISP nível 1/2/3","rede pública","comutação por pacotes"]'::jsonb,
  '{"estrategia":["20-27","46-56"],"gran":["7-10","133-134"]}'::jsonb
FROM papiro.macro_area m WHERE m.slug = 'informatica.redes_internet'
ON CONFLICT (slug_hierarquico) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao_breve = EXCLUDED.descricao_breve,
  objetivo_pedagogico = EXCLUDED.objetivo_pedagogico,
  ordem_curricular = EXCLUDED.ordem_curricular,
  tempo_estudo_min = EXCLUDED.tempo_estudo_min,
  profundidade_estrat = EXCLUDED.profundidade_estrat,
  profundidade_gran = EXCLUDED.profundidade_gran,
  conceitos_principais = EXCLUDED.conceitos_principais,
  mapeamento_paginas = EXCLUDED.mapeamento_paginas;

-- [7] Intranet, Extranet e VPN
INSERT INTO papiro.tema (
  macro_area_id, slug_hierarquico, nome, descricao_breve,
  objetivo_pedagogico, ordem_curricular, tempo_estudo_min,
  profundidade_estrat, profundidade_gran,
  conceitos_principais, mapeamento_paginas
)
SELECT m.id,
  'informatica.redes_internet.intranet_extranet_vpn',
  'Intranet, Extranet e VPN',
  'Distinção entre Intranet, Extranet e Internet, com VPN autônoma.',
  'Diferenciar os três ambientes e dominar VPN.',
  7, 60,
  'alta', 'alta',
  '["intranet","extranet","VPN","tunelamento","IPSec","L2TP","Site-to-Site","Client-to-Site","B2B"]'::jsonb,
  '{"estrategia":["5-22"],"gran":["169-179","32-33","253"]}'::jsonb
FROM papiro.macro_area m WHERE m.slug = 'informatica.redes_internet'
ON CONFLICT (slug_hierarquico) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao_breve = EXCLUDED.descricao_breve,
  objetivo_pedagogico = EXCLUDED.objetivo_pedagogico,
  ordem_curricular = EXCLUDED.ordem_curricular,
  tempo_estudo_min = EXCLUDED.tempo_estudo_min,
  profundidade_estrat = EXCLUDED.profundidade_estrat,
  profundidade_gran = EXCLUDED.profundidade_gran,
  conceitos_principais = EXCLUDED.conceitos_principais,
  mapeamento_paginas = EXCLUDED.mapeamento_paginas;

-- [8] Web (WWW): Conceitos, Componentes e Gerações
INSERT INTO papiro.tema (
  macro_area_id, slug_hierarquico, nome, descricao_breve,
  objetivo_pedagogico, ordem_curricular, tempo_estudo_min,
  profundidade_estrat, profundidade_gran,
  conceitos_principais, mapeamento_paginas
)
SELECT m.id,
  'informatica.redes_internet.web_www_geracoes',
  'Web (WWW): Conceitos, Componentes e Gerações',
  'Web vs Internet, componentes e gerações 1.0 → 3.0.',
  'Separar Web de Internet e dominar componentes e gerações.',
  8, 50,
  'alta', 'baixa',
  '["WWW × Internet","hipertexto","URL","navegador","servidor web","Web 1.0/2.0/3.0","HTML"]'::jsonb,
  '{"estrategia":["28-36"],"gran":["11-13","153-154","194-197"]}'::jsonb
FROM papiro.macro_area m WHERE m.slug = 'informatica.redes_internet'
ON CONFLICT (slug_hierarquico) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao_breve = EXCLUDED.descricao_breve,
  objetivo_pedagogico = EXCLUDED.objetivo_pedagogico,
  ordem_curricular = EXCLUDED.ordem_curricular,
  tempo_estudo_min = EXCLUDED.tempo_estudo_min,
  profundidade_estrat = EXCLUDED.profundidade_estrat,
  profundidade_gran = EXCLUDED.profundidade_gran,
  conceitos_principais = EXCLUDED.conceitos_principais,
  mapeamento_paginas = EXCLUDED.mapeamento_paginas;

-- [9] Motores de Busca e Operadores de Pesquisa
INSERT INTO papiro.tema (
  macro_area_id, slug_hierarquico, nome, descricao_breve,
  objetivo_pedagogico, ordem_curricular, tempo_estudo_min,
  profundidade_estrat, profundidade_gran,
  conceitos_principais, mapeamento_paginas
)
SELECT m.id,
  'informatica.redes_internet.motores_busca',
  'Motores de Busca e Operadores de Pesquisa',
  'Funcionamento de buscadores e operadores de pesquisa.',
  'Saber usar e descrever buscadores — relevante para investigação.',
  9, 30,
  'baixa', 'alta',
  '["motor de busca","indexação","operadores de pesquisa","relevância de resultados"]'::jsonb,
  '{"estrategia":["28-36"],"gran":["13-31"]}'::jsonb
FROM papiro.macro_area m WHERE m.slug = 'informatica.redes_internet'
ON CONFLICT (slug_hierarquico) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao_breve = EXCLUDED.descricao_breve,
  objetivo_pedagogico = EXCLUDED.objetivo_pedagogico,
  ordem_curricular = EXCLUDED.ordem_curricular,
  tempo_estudo_min = EXCLUDED.tempo_estudo_min,
  profundidade_estrat = EXCLUDED.profundidade_estrat,
  profundidade_gran = EXCLUDED.profundidade_gran,
  conceitos_principais = EXCLUDED.conceitos_principais,
  mapeamento_paginas = EXCLUDED.mapeamento_paginas;

-- [10] Redes Sociais e Aplicativos de Mensagem
INSERT INTO papiro.tema (
  macro_area_id, slug_hierarquico, nome, descricao_breve,
  objetivo_pedagogico, ordem_curricular, tempo_estudo_min,
  profundidade_estrat, profundidade_gran,
  conceitos_principais, mapeamento_paginas
)
SELECT m.id,
  'informatica.redes_internet.redes_sociais',
  'Redes Sociais e Aplicativos de Mensagem',
  'Categorias de redes sociais e principais plataformas, com foco investigativo.',
  'Conhecer as categorias e recursos das principais redes sociais e apps de mensagem, no contexto de investigação digital.',
  10, 40,
  'baixa', 'alta',
  '["categorias de redes sociais","WhatsApp","Facebook/Messenger","recursos e privacidade","conteúdo gerado pelo usuário"]'::jsonb,
  '{"estrategia":["5-13","28-36"],"gran":["57-72"]}'::jsonb
FROM papiro.macro_area m WHERE m.slug = 'informatica.redes_internet'
ON CONFLICT (slug_hierarquico) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao_breve = EXCLUDED.descricao_breve,
  objetivo_pedagogico = EXCLUDED.objetivo_pedagogico,
  ordem_curricular = EXCLUDED.ordem_curricular,
  tempo_estudo_min = EXCLUDED.tempo_estudo_min,
  profundidade_estrat = EXCLUDED.profundidade_estrat,
  profundidade_gran = EXCLUDED.profundidade_gran,
  conceitos_principais = EXCLUDED.conceitos_principais,
  mapeamento_paginas = EXCLUDED.mapeamento_paginas;

-- [11] Deep Web, Dark Web e Rede Tor
INSERT INTO papiro.tema (
  macro_area_id, slug_hierarquico, nome, descricao_breve,
  objetivo_pedagogico, ordem_curricular, tempo_estudo_min,
  profundidade_estrat, profundidade_gran,
  conceitos_principais, mapeamento_paginas
)
SELECT m.id,
  'informatica.redes_internet.deep_dark_web',
  'Deep Web, Dark Web e Rede Tor',
  'Surface/Deep/Dark Web, rede Tor, .onion e casos policiais.',
  'Distinguir as camadas da Web e a Dark Web no contexto investigativo.',
  11, 40,
  'alta', 'media',
  '["surface web","deep web","dark web","rede Tor",".onion","Silk Road","caso Massacre de Suzano"]'::jsonb,
  '{"estrategia":["37-45"],"gran":["53-57"]}'::jsonb
FROM papiro.macro_area m WHERE m.slug = 'informatica.redes_internet'
ON CONFLICT (slug_hierarquico) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao_breve = EXCLUDED.descricao_breve,
  objetivo_pedagogico = EXCLUDED.objetivo_pedagogico,
  ordem_curricular = EXCLUDED.ordem_curricular,
  tempo_estudo_min = EXCLUDED.tempo_estudo_min,
  profundidade_estrat = EXCLUDED.profundidade_estrat,
  profundidade_gran = EXCLUDED.profundidade_gran,
  conceitos_principais = EXCLUDED.conceitos_principais,
  mapeamento_paginas = EXCLUDED.mapeamento_paginas;

-- [12] Modelos de Referência: OSI/ISO e TCP/IP
INSERT INTO papiro.tema (
  macro_area_id, slug_hierarquico, nome, descricao_breve,
  objetivo_pedagogico, ordem_curricular, tempo_estudo_min,
  profundidade_estrat, profundidade_gran,
  conceitos_principais, mapeamento_paginas
)
SELECT m.id,
  'informatica.redes_internet.modelos_osi_tcpip',
  'Modelos de Referência: OSI/ISO e TCP/IP',
  'As 7 camadas OSI, as 4 camadas TCP/IP e correspondência.',
  'Construir o mapa das camadas antes dos protocolos específicos.',
  12, 55,
  'alta', 'alta',
  '["protocolo","modelo OSI (7 camadas)","arquitetura TCP/IP (4 camadas)","correspondência OSI×TCP/IP","dispositivos por camada"]'::jsonb,
  '{"estrategia":["3-13"],"gran":["135-148"]}'::jsonb
FROM papiro.macro_area m WHERE m.slug = 'informatica.redes_internet'
ON CONFLICT (slug_hierarquico) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao_breve = EXCLUDED.descricao_breve,
  objetivo_pedagogico = EXCLUDED.objetivo_pedagogico,
  ordem_curricular = EXCLUDED.ordem_curricular,
  tempo_estudo_min = EXCLUDED.tempo_estudo_min,
  profundidade_estrat = EXCLUDED.profundidade_estrat,
  profundidade_gran = EXCLUDED.profundidade_gran,
  conceitos_principais = EXCLUDED.conceitos_principais,
  mapeamento_paginas = EXCLUDED.mapeamento_paginas;

-- [13] Camada de Rede e Transporte: IP, TCP e UDP
INSERT INTO papiro.tema (
  macro_area_id, slug_hierarquico, nome, descricao_breve,
  objetivo_pedagogico, ordem_curricular, tempo_estudo_min,
  profundidade_estrat, profundidade_gran,
  conceitos_principais, mapeamento_paginas
)
SELECT m.id,
  'informatica.redes_internet.ip_tcp_udp',
  'Camada de Rede e Transporte: IP, TCP e UDP',
  'Protocolo IP, TCP confiável e UDP.',
  'Dominar o núcleo funcional do TCP/IP nas camadas de rede e transporte.',
  13, 60,
  'alta', 'alta',
  '["pacote IP","datagrama","TCP","3-way handshake","controle de fluxo","controle de congestionamento","portas","UDP"]'::jsonb,
  '{"estrategia":["14-31"],"gran":["135-152"]}'::jsonb
FROM papiro.macro_area m WHERE m.slug = 'informatica.redes_internet'
ON CONFLICT (slug_hierarquico) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao_breve = EXCLUDED.descricao_breve,
  objetivo_pedagogico = EXCLUDED.objetivo_pedagogico,
  ordem_curricular = EXCLUDED.ordem_curricular,
  tempo_estudo_min = EXCLUDED.tempo_estudo_min,
  profundidade_estrat = EXCLUDED.profundidade_estrat,
  profundidade_gran = EXCLUDED.profundidade_gran,
  conceitos_principais = EXCLUDED.conceitos_principais,
  mapeamento_paginas = EXCLUDED.mapeamento_paginas;

-- [14] Endereçamento IP e Transição para IPv6
INSERT INTO papiro.tema (
  macro_area_id, slug_hierarquico, nome, descricao_breve,
  objetivo_pedagogico, ordem_curricular, tempo_estudo_min,
  profundidade_estrat, profundidade_gran,
  conceitos_principais, mapeamento_paginas
)
SELECT m.id,
  'informatica.redes_internet.enderecamento_ip_ipv6',
  'Endereçamento IP e Transição para IPv6',
  'Endereçamento IPv4, NAT, IP público/privado e transição para IPv6.',
  'Dominar a estrutura do endereçamento IP e a coexistência IPv4/IPv6, com profundidade exigida pela banca.',
  14, 55,
  'alta', 'media',
  '["endereço IP","notação decimal pontuada/binária","IPv4 × IPv6","esgotamento de IPv4","NAT","IP público/privado","IP fixo/dinâmico"]'::jsonb,
  '{"estrategia":["14-22"],"gran":["136-142","180-183"]}'::jsonb
FROM papiro.macro_area m WHERE m.slug = 'informatica.redes_internet'
ON CONFLICT (slug_hierarquico) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao_breve = EXCLUDED.descricao_breve,
  objetivo_pedagogico = EXCLUDED.objetivo_pedagogico,
  ordem_curricular = EXCLUDED.ordem_curricular,
  tempo_estudo_min = EXCLUDED.tempo_estudo_min,
  profundidade_estrat = EXCLUDED.profundidade_estrat,
  profundidade_gran = EXCLUDED.profundidade_gran,
  conceitos_principais = EXCLUDED.conceitos_principais,
  mapeamento_paginas = EXCLUDED.mapeamento_paginas;

-- [15] DNS, URL e Identificadores Físicos/Móveis
INSERT INTO papiro.tema (
  macro_area_id, slug_hierarquico, nome, descricao_breve,
  objetivo_pedagogico, ordem_curricular, tempo_estudo_min,
  profundidade_estrat, profundidade_gran,
  conceitos_principais, mapeamento_paginas
)
SELECT m.id,
  'informatica.redes_internet.dns_identificadores',
  'DNS, URL e Identificadores Físicos/Móveis',
  'Resolução de nomes (DNS/Whois), URL e identificadores de hardware (MAC/IMEI/EID/MEID).',
  'Dominar a tradução nome↔endereço e os identificadores físicos de dispositivos.',
  15, 55,
  'alta', 'alta',
  '["DNS","hierarquia DNS","Whois","URL","MAC Address","IMEI","EID","MEID"]'::jsonb,
  '{"estrategia":["42-60"],"gran":["179-194"]}'::jsonb
FROM papiro.macro_area m WHERE m.slug = 'informatica.redes_internet'
ON CONFLICT (slug_hierarquico) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao_breve = EXCLUDED.descricao_breve,
  objetivo_pedagogico = EXCLUDED.objetivo_pedagogico,
  ordem_curricular = EXCLUDED.ordem_curricular,
  tempo_estudo_min = EXCLUDED.tempo_estudo_min,
  profundidade_estrat = EXCLUDED.profundidade_estrat,
  profundidade_gran = EXCLUDED.profundidade_gran,
  conceitos_principais = EXCLUDED.conceitos_principais,
  mapeamento_paginas = EXCLUDED.mapeamento_paginas;

-- [16] Protocolos de Aplicação: E-mail e DHCP
INSERT INTO papiro.tema (
  macro_area_id, slug_hierarquico, nome, descricao_breve,
  objetivo_pedagogico, ordem_curricular, tempo_estudo_min,
  profundidade_estrat, profundidade_gran,
  conceitos_principais, mapeamento_paginas
)
SELECT m.id,
  'informatica.redes_internet.protocolos_aplicacao_email_dhcp',
  'Protocolos de Aplicação: E-mail e DHCP',
  'Protocolos de e-mail (SMTP/POP/IMAP/MIME/WebMail) e DHCP.',
  'Dominar os protocolos de correio e configuração dinâmica.',
  16, 55,
  'alta', 'alta',
  '["SMTP","POP","IMAP","WebMail","MIME","campos de envio","DHCP"]'::jsonb,
  '{"estrategia":["23-51"],"gran":["102-112","148-153"]}'::jsonb
FROM papiro.macro_area m WHERE m.slug = 'informatica.redes_internet'
ON CONFLICT (slug_hierarquico) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao_breve = EXCLUDED.descricao_breve,
  objetivo_pedagogico = EXCLUDED.objetivo_pedagogico,
  ordem_curricular = EXCLUDED.ordem_curricular,
  tempo_estudo_min = EXCLUDED.tempo_estudo_min,
  profundidade_estrat = EXCLUDED.profundidade_estrat,
  profundidade_gran = EXCLUDED.profundidade_gran,
  conceitos_principais = EXCLUDED.conceitos_principais,
  mapeamento_paginas = EXCLUDED.mapeamento_paginas;

-- [17] Protocolos Web e de Transferência (HTTP/HTTPS/FTP)
INSERT INTO papiro.tema (
  macro_area_id, slug_hierarquico, nome, descricao_breve,
  objetivo_pedagogico, ordem_curricular, tempo_estudo_min,
  profundidade_estrat, profundidade_gran,
  conceitos_principais, mapeamento_paginas
)
SELECT m.id,
  'informatica.redes_internet.protocolos_web_transferencia',
  'Protocolos Web e de Transferência (HTTP/HTTPS/FTP)',
  'HTTP, HTTPS, FTP e download/upload.',
  'Dominar os protocolos de acesso à Web e transferência de arquivos.',
  17, 45,
  'alta', 'alta',
  '["HTTP","HTTPS","FTP","download","upload"]'::jsonb,
  '{"estrategia":["52-69"],"gran":["153-160","197-200"]}'::jsonb
FROM papiro.macro_area m WHERE m.slug = 'informatica.redes_internet'
ON CONFLICT (slug_hierarquico) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao_breve = EXCLUDED.descricao_breve,
  objetivo_pedagogico = EXCLUDED.objetivo_pedagogico,
  ordem_curricular = EXCLUDED.ordem_curricular,
  tempo_estudo_min = EXCLUDED.tempo_estudo_min,
  profundidade_estrat = EXCLUDED.profundidade_estrat,
  profundidade_gran = EXCLUDED.profundidade_gran,
  conceitos_principais = EXCLUDED.conceitos_principais,
  mapeamento_paginas = EXCLUDED.mapeamento_paginas;

-- [18] Acesso Remoto, Gerenciamento e VoIP
INSERT INTO papiro.tema (
  macro_area_id, slug_hierarquico, nome, descricao_breve,
  objetivo_pedagogico, ordem_curricular, tempo_estudo_min,
  profundidade_estrat, profundidade_gran,
  conceitos_principais, mapeamento_paginas
)
SELECT m.id,
  'informatica.redes_internet.acesso_remoto_voip',
  'Acesso Remoto, Gerenciamento e VoIP',
  'Telnet, SSH, SNMP, NNTP, IRC, RDP e VoIP/videoconferência.',
  'Conhecer protocolos de acesso/gerência remota e serviços de voz/vídeo.',
  18, 45,
  'alta', 'alta',
  '["Telnet","SSH","SNMP","NNTP","IRC","RDP","VoIP","videoconferência"]'::jsonb,
  '{"estrategia":["70-78"],"gran":["112-117","158-169"]}'::jsonb
FROM papiro.macro_area m WHERE m.slug = 'informatica.redes_internet'
ON CONFLICT (slug_hierarquico) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao_breve = EXCLUDED.descricao_breve,
  objetivo_pedagogico = EXCLUDED.objetivo_pedagogico,
  ordem_curricular = EXCLUDED.ordem_curricular,
  tempo_estudo_min = EXCLUDED.tempo_estudo_min,
  profundidade_estrat = EXCLUDED.profundidade_estrat,
  profundidade_gran = EXCLUDED.profundidade_gran,
  conceitos_principais = EXCLUDED.conceitos_principais,
  mapeamento_paginas = EXCLUDED.mapeamento_paginas;

-- [19] Tecnologias de Acesso à Internet e Telefonia Móvel
INSERT INTO papiro.tema (
  macro_area_id, slug_hierarquico, nome, descricao_breve,
  objetivo_pedagogico, ordem_curricular, tempo_estudo_min,
  profundidade_estrat, profundidade_gran,
  conceitos_principais, mapeamento_paginas
)
SELECT m.id,
  'informatica.redes_internet.tecnologias_acesso',
  'Tecnologias de Acesso à Internet e Telefonia Móvel',
  'Dial-up, ADSL, HFC, fibra, PLC, rádio, satélite e gerações móveis 1G-5G.',
  'Conhecer formas de conexão à Internet e evolução da telefonia móvel.',
  19, 50,
  'alta', 'media',
  '["Dial-up","ADSL","HFC","fibra óptica","PLC","satélite","banda larga","gerações 1G-5G"]'::jsonb,
  '{"estrategia":["46-67"],"gran":["199-208","260"]}'::jsonb
FROM papiro.macro_area m WHERE m.slug = 'informatica.redes_internet'
ON CONFLICT (slug_hierarquico) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao_breve = EXCLUDED.descricao_breve,
  objetivo_pedagogico = EXCLUDED.objetivo_pedagogico,
  ordem_curricular = EXCLUDED.ordem_curricular,
  tempo_estudo_min = EXCLUDED.tempo_estudo_min,
  profundidade_estrat = EXCLUDED.profundidade_estrat,
  profundidade_gran = EXCLUDED.profundidade_gran,
  conceitos_principais = EXCLUDED.conceitos_principais,
  mapeamento_paginas = EXCLUDED.mapeamento_paginas;

-- [20] Computação em Nuvem (Cloud Computing)
INSERT INTO papiro.tema (
  macro_area_id, slug_hierarquico, nome, descricao_breve,
  objetivo_pedagogico, ordem_curricular, tempo_estudo_min,
  profundidade_estrat, profundidade_gran,
  conceitos_principais, mapeamento_paginas
)
SELECT m.id,
  'informatica.redes_internet.computacao_nuvem',
  'Computação em Nuvem (Cloud Computing)',
  'Conceito, características, modalidades de instalação e modelos de serviço.',
  'Dominar a computação em nuvem como tema autônomo de alta recorrência.',
  20, 45,
  'ausente', 'alta',
  '["cloud computing","características essenciais","nuvem pública/privada/híbrida/comunitária","SaaS","PaaS","IaaS"]'::jsonb,
  '{"estrategia":[],"gran":["31-52"]}'::jsonb
FROM papiro.macro_area m WHERE m.slug = 'informatica.redes_internet'
ON CONFLICT (slug_hierarquico) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao_breve = EXCLUDED.descricao_breve,
  objetivo_pedagogico = EXCLUDED.objetivo_pedagogico,
  ordem_curricular = EXCLUDED.ordem_curricular,
  tempo_estudo_min = EXCLUDED.tempo_estudo_min,
  profundidade_estrat = EXCLUDED.profundidade_estrat,
  profundidade_gran = EXCLUDED.profundidade_gran,
  conceitos_principais = EXCLUDED.conceitos_principais,
  mapeamento_paginas = EXCLUDED.mapeamento_paginas;

-- [21] IoT e Tecnologias Emergentes
INSERT INTO papiro.tema (
  macro_area_id, slug_hierarquico, nome, descricao_breve,
  objetivo_pedagogico, ordem_curricular, tempo_estudo_min,
  profundidade_estrat, profundidade_gran,
  conceitos_principais, mapeamento_paginas
)
SELECT m.id,
  'informatica.redes_internet.iot_emergentes',
  'IoT e Tecnologias Emergentes',
  'Internet das Coisas: conceito, hardware, tecnologias de comunicação e IA.',
  'Compreender IoT, seus componentes e tecnologias de conectividade.',
  21, 40,
  'alta', 'media',
  '["IoT","hardware IoT","Zigbee/LoRa/Sigfox/NB-IoT","aplicações (saúde, agro, indústria)","IA com IoT","vantagens e desvantagens"]'::jsonb,
  '{"estrategia":["46-56"],"gran":["128-133"]}'::jsonb
FROM papiro.macro_area m WHERE m.slug = 'informatica.redes_internet'
ON CONFLICT (slug_hierarquico) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao_breve = EXCLUDED.descricao_breve,
  objetivo_pedagogico = EXCLUDED.objetivo_pedagogico,
  ordem_curricular = EXCLUDED.ordem_curricular,
  tempo_estudo_min = EXCLUDED.tempo_estudo_min,
  profundidade_estrat = EXCLUDED.profundidade_estrat,
  profundidade_gran = EXCLUDED.profundidade_gran,
  conceitos_principais = EXCLUDED.conceitos_principais,
  mapeamento_paginas = EXCLUDED.mapeamento_paginas;

-- [22] Bitcoin, Blockchain e Criptomoedas
INSERT INTO papiro.tema (
  macro_area_id, slug_hierarquico, nome, descricao_breve,
  objetivo_pedagogico, ordem_curricular, tempo_estudo_min,
  profundidade_estrat, profundidade_gran,
  conceitos_principais, mapeamento_paginas
)
SELECT m.id,
  'informatica.redes_internet.bitcoin_blockchain',
  'Bitcoin, Blockchain e Criptomoedas',
  'Bitcoin, lógica de blockchain e criptomoedas, com gancho investigativo.',
  'Compreender criptomoedas e blockchain, incluindo rastreabilidade e uso ilícito.',
  22, 35,
  'ausente', 'alta',
  '["Bitcoin","blockchain","criptomoeda","mineração","carteira digital"]'::jsonb,
  '{"estrategia":[],"gran":["118-126"]}'::jsonb
FROM papiro.macro_area m WHERE m.slug = 'informatica.redes_internet'
ON CONFLICT (slug_hierarquico) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao_breve = EXCLUDED.descricao_breve,
  objetivo_pedagogico = EXCLUDED.objetivo_pedagogico,
  ordem_curricular = EXCLUDED.ordem_curricular,
  tempo_estudo_min = EXCLUDED.tempo_estudo_min,
  profundidade_estrat = EXCLUDED.profundidade_estrat,
  profundidade_gran = EXCLUDED.profundidade_gran,
  conceitos_principais = EXCLUDED.conceitos_principais,
  mapeamento_paginas = EXCLUDED.mapeamento_paginas;

-- ---------- 4. Prereqs: DELETE da macro_area, INSERT do estado atual ----------
DELETE FROM papiro.tema_prereq
WHERE tema_id IN (
  SELECT id FROM papiro.tema
  WHERE macro_area_id = (SELECT id FROM papiro.macro_area WHERE slug = 'informatica.redes_internet')
);

INSERT INTO papiro.tema_prereq (tema_id, prereq_tema_id)
SELECT t1.id, t2.id FROM papiro.tema t1, papiro.tema t2
WHERE t1.slug_hierarquico = 'informatica.redes_internet.classificacao_redes' AND t2.slug_hierarquico = 'informatica.redes_internet.fundamentos_redes';
INSERT INTO papiro.tema_prereq (tema_id, prereq_tema_id)
SELECT t1.id, t2.id FROM papiro.tema t1, papiro.tema t2
WHERE t1.slug_hierarquico = 'informatica.redes_internet.topologias_transmissao' AND t2.slug_hierarquico = 'informatica.redes_internet.fundamentos_redes';
INSERT INTO papiro.tema_prereq (tema_id, prereq_tema_id)
SELECT t1.id, t2.id FROM papiro.tema t1, papiro.tema t2
WHERE t1.slug_hierarquico = 'informatica.redes_internet.meios_equipamentos' AND t2.slug_hierarquico = 'informatica.redes_internet.fundamentos_redes';
INSERT INTO papiro.tema_prereq (tema_id, prereq_tema_id)
SELECT t1.id, t2.id FROM papiro.tema t1, papiro.tema t2
WHERE t1.slug_hierarquico = 'informatica.redes_internet.meios_equipamentos' AND t2.slug_hierarquico = 'informatica.redes_internet.topologias_transmissao';
INSERT INTO papiro.tema_prereq (tema_id, prereq_tema_id)
SELECT t1.id, t2.id FROM papiro.tema t1, papiro.tema t2
WHERE t1.slug_hierarquico = 'informatica.redes_internet.padroes_wifi' AND t2.slug_hierarquico = 'informatica.redes_internet.meios_equipamentos';
INSERT INTO papiro.tema_prereq (tema_id, prereq_tema_id)
SELECT t1.id, t2.id FROM papiro.tema t1, papiro.tema t2
WHERE t1.slug_hierarquico = 'informatica.redes_internet.internet_origem_funcionamento' AND t2.slug_hierarquico = 'informatica.redes_internet.classificacao_redes';
INSERT INTO papiro.tema_prereq (tema_id, prereq_tema_id)
SELECT t1.id, t2.id FROM papiro.tema t1, papiro.tema t2
WHERE t1.slug_hierarquico = 'informatica.redes_internet.intranet_extranet_vpn' AND t2.slug_hierarquico = 'informatica.redes_internet.classificacao_redes';
INSERT INTO papiro.tema_prereq (tema_id, prereq_tema_id)
SELECT t1.id, t2.id FROM papiro.tema t1, papiro.tema t2
WHERE t1.slug_hierarquico = 'informatica.redes_internet.intranet_extranet_vpn' AND t2.slug_hierarquico = 'informatica.redes_internet.internet_origem_funcionamento';
INSERT INTO papiro.tema_prereq (tema_id, prereq_tema_id)
SELECT t1.id, t2.id FROM papiro.tema t1, papiro.tema t2
WHERE t1.slug_hierarquico = 'informatica.redes_internet.web_www_geracoes' AND t2.slug_hierarquico = 'informatica.redes_internet.internet_origem_funcionamento';
INSERT INTO papiro.tema_prereq (tema_id, prereq_tema_id)
SELECT t1.id, t2.id FROM papiro.tema t1, papiro.tema t2
WHERE t1.slug_hierarquico = 'informatica.redes_internet.motores_busca' AND t2.slug_hierarquico = 'informatica.redes_internet.web_www_geracoes';
INSERT INTO papiro.tema_prereq (tema_id, prereq_tema_id)
SELECT t1.id, t2.id FROM papiro.tema t1, papiro.tema t2
WHERE t1.slug_hierarquico = 'informatica.redes_internet.redes_sociais' AND t2.slug_hierarquico = 'informatica.redes_internet.web_www_geracoes';
INSERT INTO papiro.tema_prereq (tema_id, prereq_tema_id)
SELECT t1.id, t2.id FROM papiro.tema t1, papiro.tema t2
WHERE t1.slug_hierarquico = 'informatica.redes_internet.deep_dark_web' AND t2.slug_hierarquico = 'informatica.redes_internet.web_www_geracoes';
INSERT INTO papiro.tema_prereq (tema_id, prereq_tema_id)
SELECT t1.id, t2.id FROM papiro.tema t1, papiro.tema t2
WHERE t1.slug_hierarquico = 'informatica.redes_internet.modelos_osi_tcpip' AND t2.slug_hierarquico = 'informatica.redes_internet.fundamentos_redes';
INSERT INTO papiro.tema_prereq (tema_id, prereq_tema_id)
SELECT t1.id, t2.id FROM papiro.tema t1, papiro.tema t2
WHERE t1.slug_hierarquico = 'informatica.redes_internet.modelos_osi_tcpip' AND t2.slug_hierarquico = 'informatica.redes_internet.internet_origem_funcionamento';
INSERT INTO papiro.tema_prereq (tema_id, prereq_tema_id)
SELECT t1.id, t2.id FROM papiro.tema t1, papiro.tema t2
WHERE t1.slug_hierarquico = 'informatica.redes_internet.ip_tcp_udp' AND t2.slug_hierarquico = 'informatica.redes_internet.modelos_osi_tcpip';
INSERT INTO papiro.tema_prereq (tema_id, prereq_tema_id)
SELECT t1.id, t2.id FROM papiro.tema t1, papiro.tema t2
WHERE t1.slug_hierarquico = 'informatica.redes_internet.enderecamento_ip_ipv6' AND t2.slug_hierarquico = 'informatica.redes_internet.ip_tcp_udp';
INSERT INTO papiro.tema_prereq (tema_id, prereq_tema_id)
SELECT t1.id, t2.id FROM papiro.tema t1, papiro.tema t2
WHERE t1.slug_hierarquico = 'informatica.redes_internet.dns_identificadores' AND t2.slug_hierarquico = 'informatica.redes_internet.enderecamento_ip_ipv6';
INSERT INTO papiro.tema_prereq (tema_id, prereq_tema_id)
SELECT t1.id, t2.id FROM papiro.tema t1, papiro.tema t2
WHERE t1.slug_hierarquico = 'informatica.redes_internet.protocolos_aplicacao_email_dhcp' AND t2.slug_hierarquico = 'informatica.redes_internet.modelos_osi_tcpip';
INSERT INTO papiro.tema_prereq (tema_id, prereq_tema_id)
SELECT t1.id, t2.id FROM papiro.tema t1, papiro.tema t2
WHERE t1.slug_hierarquico = 'informatica.redes_internet.protocolos_web_transferencia' AND t2.slug_hierarquico = 'informatica.redes_internet.modelos_osi_tcpip';
INSERT INTO papiro.tema_prereq (tema_id, prereq_tema_id)
SELECT t1.id, t2.id FROM papiro.tema t1, papiro.tema t2
WHERE t1.slug_hierarquico = 'informatica.redes_internet.protocolos_web_transferencia' AND t2.slug_hierarquico = 'informatica.redes_internet.dns_identificadores';
INSERT INTO papiro.tema_prereq (tema_id, prereq_tema_id)
SELECT t1.id, t2.id FROM papiro.tema t1, papiro.tema t2
WHERE t1.slug_hierarquico = 'informatica.redes_internet.acesso_remoto_voip' AND t2.slug_hierarquico = 'informatica.redes_internet.modelos_osi_tcpip';
INSERT INTO papiro.tema_prereq (tema_id, prereq_tema_id)
SELECT t1.id, t2.id FROM papiro.tema t1, papiro.tema t2
WHERE t1.slug_hierarquico = 'informatica.redes_internet.tecnologias_acesso' AND t2.slug_hierarquico = 'informatica.redes_internet.meios_equipamentos';
INSERT INTO papiro.tema_prereq (tema_id, prereq_tema_id)
SELECT t1.id, t2.id FROM papiro.tema t1, papiro.tema t2
WHERE t1.slug_hierarquico = 'informatica.redes_internet.computacao_nuvem' AND t2.slug_hierarquico = 'informatica.redes_internet.internet_origem_funcionamento';
INSERT INTO papiro.tema_prereq (tema_id, prereq_tema_id)
SELECT t1.id, t2.id FROM papiro.tema t1, papiro.tema t2
WHERE t1.slug_hierarquico = 'informatica.redes_internet.iot_emergentes' AND t2.slug_hierarquico = 'informatica.redes_internet.internet_origem_funcionamento';
INSERT INTO papiro.tema_prereq (tema_id, prereq_tema_id)
SELECT t1.id, t2.id FROM papiro.tema t1, papiro.tema t2
WHERE t1.slug_hierarquico = 'informatica.redes_internet.bitcoin_blockchain' AND t2.slug_hierarquico = 'informatica.redes_internet.internet_origem_funcionamento';

-- Total de pares prereq emitidos: 25

-- ---------- 5. RAISE WARNING para temas órfãos (DB sem JSON) ----------
DO $$
DECLARE orfaos TEXT[];
BEGIN
  SELECT array_agg(slug_hierarquico) INTO orfaos
  FROM papiro.tema
  WHERE macro_area_id = (SELECT id FROM papiro.macro_area WHERE slug = 'informatica.redes_internet')
    AND slug_hierarquico NOT IN ('informatica.redes_internet.fundamentos_redes', 'informatica.redes_internet.classificacao_redes', 'informatica.redes_internet.topologias_transmissao', 'informatica.redes_internet.meios_equipamentos', 'informatica.redes_internet.padroes_wifi', 'informatica.redes_internet.internet_origem_funcionamento', 'informatica.redes_internet.intranet_extranet_vpn', 'informatica.redes_internet.web_www_geracoes', 'informatica.redes_internet.motores_busca', 'informatica.redes_internet.redes_sociais', 'informatica.redes_internet.deep_dark_web', 'informatica.redes_internet.modelos_osi_tcpip', 'informatica.redes_internet.ip_tcp_udp', 'informatica.redes_internet.enderecamento_ip_ipv6', 'informatica.redes_internet.dns_identificadores', 'informatica.redes_internet.protocolos_aplicacao_email_dhcp', 'informatica.redes_internet.protocolos_web_transferencia', 'informatica.redes_internet.acesso_remoto_voip', 'informatica.redes_internet.tecnologias_acesso', 'informatica.redes_internet.computacao_nuvem', 'informatica.redes_internet.iot_emergentes', 'informatica.redes_internet.bitcoin_blockchain');
  IF array_length(orfaos, 1) > 0 THEN
    RAISE WARNING 'PAPIRO: % temas órfãos no DB (não no JSON atual): %',
      array_length(orfaos, 1), orfaos;
  END IF;
END $$;

COMMIT;
