"""
Rename all law directories in D:/leis/selecao/ to include popular names.
Format: original-id_nome-popular
Example: lei-10406-2002_codigo-civil
"""
import os, re, json, unicodedata

SELECAO = "D:/leis/selecao"

# ── Complete mapping: directory name → popular name ──────────────────
NOMES = {
    # ADMINISTRATIVO
    "decreto-1171-1994": "codigo-etica-servidor-federal",
    "decreto-6029-2007": "sistema-gestao-da-etica",
    "decreto-9203-2017": "politica-de-governanca",
    "decreto-lei-200-1967": "organizacao-administracao-federal",
    "decreto-lei-25-1937": "lei-do-tombamento",
    "decreto-lei-3365-1941": "lei-de-desapropriacao",
    "lc-73-1993": "lei-organica-da-agu",
    "lei-11079-2004": "parcerias-publico-privadas-ppps",
    "lei-11107-2005": "consorcios-publicos",
    "lei-11445-2007": "saneamento-basico",
    "lei-12527-2011": "lei-acesso-a-informacao",
    "lei-12813-2013": "conflito-de-interesses",
    "lei-12846-2013": "lei-anticorrupcao",
    "lei-13019-2014": "marco-regulatorio-osc-mrosc",
    "lei-13303-2016": "lei-das-estatais",
    "lei-13460-2017": "usuarios-servicos-publicos",
    "lei-13848-2019": "agencias-reguladoras",
    "lei-13874-2019": "liberdade-economica",
    "lei-13934-2019": "contrato-de-desempenho",
    "lei-14129-2021": "governo-digital",
    "lei-14133-2021": "nova-lei-de-licitacoes",
    "lei-8112-1990": "regime-juridico-servidores-federais",
    "lei-8429-1992": "improbidade-administrativa",
    "lei-8987-1995": "concessoes-e-permissoes",
    "lei-9637-1998": "organizacoes-sociais-os",
    "lei-9784-1999": "processo-administrativo",
    "lei-9790-1999": "oscip",
    "lei-9986-2000": "rh-agencias-reguladoras",
    "lei-8443-1992": "lei-organica-do-tcu",
    "lei-10180-2001": "administracao-financeira-federal",
    "lei-12990-2014": "cotas-raciais-concursos",
    "decreto-9830-2019": "regulamenta-lindb",
    "lei-11358-2006": "carreiras-e-cargos-pf",
    "decreto-59310-1966": "regulamenta-lei-4878",
    "decreto-5480-2005": "sistema-de-correicao",
    "decreto-11102-2022": "regulamenta-sistema-correicao",
    "decreto-11531-2023": "gestao-desempenho-teletrabalho",
    "lei-12462-2011": "rdc-contratacoes-publicas",
    "decreto-9492-2018": "regulamenta-ouvidorias",

    # AGRÁRIO
    "lei-4504-1964": "estatuto-da-terra",
    "lei-4947-1966": "normas-direito-agrario",
    "lei-8629-1993": "reforma-agraria",
    "lei-11952-2009": "regularizacao-fundiaria-amazonia",
    "lei-10267-2001": "cadastro-imoveis-rurais",
    "lei-14944-2024": "marco-temporal-terras-indigenas",
    "decreto-4449-2002": "regulamenta-cnir",

    # AMBIENTAL
    "lc-140-2011": "cooperacao-federativa-ambiental",
    "lei-12305-2010": "residuos-solidos",
    "lei-12651-2012": "codigo-florestal",
    "lei-15190-2025": "licenciamento-ambiental",
    "lei-6938-1981": "politica-nacional-meio-ambiente",
    "lei-9433-1997": "lei-das-aguas",
    "lei-9985-2000": "snuc",
    "lei-12187-2009": "mudanca-do-clima",
    "decreto-6514-2008": "infracoes-administrativas-ambientais",
    "decreto-4340-2002": "regulamenta-snuc",
    "lei-5197-1967": "protecao-a-fauna",
    "lei-11428-2006": "mata-atlantica",
    "lei-12334-2010": "seguranca-de-barragens",
    "lei-14850-2024": "mercado-de-carbono",
    "lei-11284-2006": "gestao-florestas-publicas",
    "lei-14066-2020": "altera-seguranca-barragens",
    "decreto-11687-2023": "regulamenta-codigo-florestal",
    "decreto-3607-2000": "implementacao-cites",
    "lei-13575-2017": "reestruturacao-anp",

    # CIVIL
    "decreto-lei-4657-1942": "lindb",
    "lei-10406-2002": "codigo-civil",
    "lei-11977-2009": "minha-casa-minha-vida",
    "lei-12318-2010": "alienacao-parental",
    "lei-4591-1964": "condominio-e-incorporacoes",
    "lei-5478-1968": "lei-de-alimentos",
    "lei-8009-1990": "impenhorabilidade-bem-de-familia",
    "lei-8245-1991": "lei-do-inquilinato",
    "lei-9278-1996": "uniao-estavel",
    "lei-9514-1997": "alienacao-fiduciaria",
    "lei-9610-1998": "direitos-autorais",

    # CONSTITUCIONAL
    "decreto-lei-201-1967": "crimes-responsabilidade-prefeitos",
    "emenda-constitucional-103-2019": "reforma-da-previdencia",
    "emenda-constitucional-115-2022": "protecao-de-dados",
    "emenda-constitucional-132-2023": "reforma-tributaria",
    "emenda-constitucional-19-1998": "reforma-administrativa",
    "emenda-constitucional-45-2004": "reforma-do-judiciario",
    "lc-95-1998": "tecnica-legislativa",
    "lei-1079-1950": "crimes-de-responsabilidade",
    "lei-11417-2006": "sumulas-vinculantes",
    "lei-12016-2009": "mandado-de-seguranca",
    "lei-12562-2011": "representacao-interventiva",
    "lei-13300-2016": "mandado-de-injuncao",
    "lei-4717-1965": "acao-popular",
    "lei-7347-1985": "acao-civil-publica",
    "lei-9507-1997": "habeas-data",
    "lei-9868-1999": "adi-e-adc",
    "lei-9882-1999": "adpf",
    "lei-5010-1966": "organizacao-justica-federal",
    "lei-11697-2008": "organizacao-judiciaria-df",

    # CONSUMIDOR
    "decreto-2181-1997": "organizacao-sndc",
    "lei-8078-1990": "codigo-defesa-do-consumidor",

    # DEFENSORIA
    "lc-80-1994": "lei-organica-defensoria",

    # DIGITAL
    "lei-12965-2014": "marco-civil-da-internet",
    "lei-13709-2018": "lgpd",

    # DIREITOS HUMANOS
    "decreto-10932-2022": "convencao-interamericana-contra-racismo",
    "decreto-1973-1996": "convencao-belem-do-para",
    "decreto-3321-1999": "protocolo-sao-salvador",
    "decreto-4377-2002": "cedaw",
    "decreto-40-1991": "convencao-contra-tortura",
    "decreto-592-1992": "pacto-direitos-civis-e-politicos",
    "decreto-678-1992": "pacto-sao-jose-da-costa-rica",
    "decreto-6949-2009": "convencao-onu-pessoas-com-deficiencia",
    "lei-13445-2017": "lei-de-migracao",

    # ECONÔMICO
    "lei-12529-2011": "defesa-da-concorrencia-cade",
    "lei-8176-1991": "crimes-contra-ordem-economica",

    # ELEITORAL
    "lc-135-2010": "ficha-limpa",
    "lc-64-1990": "lei-da-inelegibilidade",
    "lei-4737-1965": "codigo-eleitoral",
    "lei-9096-1995": "partidos-politicos",
    "lei-9504-1997": "lei-das-eleicoes",

    # EMPRESARIAL
    "decreto-2044-1908": "letra-de-cambio-e-nota-promissoria",
    "decreto-lei-911-1969": "alienacao-fiduciaria-em-garantia",
    "lei-11101-2005": "recuperacao-empresas-e-falencias",
    "lei-11795-2008": "lei-do-consorcio",
    "lei-4595-1964": "sistema-financeiro-nacional",
    "lei-4728-1965": "mercado-de-capitais",
    "lei-5474-1968": "lei-de-duplicatas",
    "lei-6024-1974": "liquidacao-instituicoes-financeiras",
    "lei-6404-1976": "sociedades-por-acoes",
    "lei-7357-1985": "lei-do-cheque",
    "lei-8934-1994": "registro-publico-empresas",
    "lei-9279-1996": "propriedade-industrial",

    # ESTATUTOS E GRUPOS VULNERÁVEIS
    "lei-10048-2000": "prioridade-de-atendimento",
    "lei-10098-2000": "lei-da-acessibilidade",
    "lei-10741-2003": "estatuto-da-pessoa-idosa",
    "lei-12288-2010": "estatuto-igualdade-racial",
    "lei-13146-2015": "estatuto-pessoa-com-deficiencia",
    "lei-6001-1973": "estatuto-do-indio",

    # ÉTICA OAB
    "lei-8906-1994": "estatuto-da-advocacia-e-oab",

    # FINANCEIRO
    "lc-101-2000": "lei-responsabilidade-fiscal-lrf",
    "lc-200-2023": "novo-arcabouco-fiscal",
    "lei-4320-1964": "normas-gerais-direito-financeiro",

    # GUARDA MUNICIPAL
    "lei-13022-2014": "estatuto-guardas-municipais",

    # IDENTIFICAÇÃO CIVIL
    "lei-7116-1983": "carteira-de-identidade",
    "lei-9454-1997": "registro-identidade-civil",
    "decreto-10977-2022": "regulamenta-carteira-identidade",
    "decreto-11797-2023": "servico-identificacao-cidadao",

    # IMOBILIÁRIO
    "lei-10931-2004": "patrimonio-de-afetacao",

    # INFÂNCIA E JUVENTUDE
    "decreto-99710-1990": "convencao-onu-direitos-crianca",
    "lei-12594-2012": "sinase",
    "lei-12852-2013": "estatuto-da-juventude",
    "lei-13431-2017": "escuta-protegida",
    "lei-15211-2025": "estatuto-digital-crianca-adolescente",
    "lei-8069-1990": "estatuto-crianca-e-adolescente-eca",
    "lei-9394-1996": "diretrizes-e-bases-educacao-ldb",

    # INTERNACIONAL
    "decreto-4388-2002": "estatuto-de-roma-tpi",
    "decreto-7030-2009": "convencao-viena-direito-tratados",
    "decreto-5015-2004": "convencao-de-palermo",
    "decreto-5017-2004": "protocolo-trafico-de-pessoas",
    "decreto-5687-2006": "convencao-de-merida",
    "decreto-154-1991": "convencao-viena-entorpecentes",
    "decreto-8833-2016": "convencao-de-budapeste",
    "decreto-5016-2004": "protocolo-trafico-ilicito-migrantes",
    "decreto-5941-2006": "protocolo-fabricacao-ilicita-armas",
    "decreto-6340-2008": "assistencia-juridica-mutua-brasil-colombia",
    "decreto-12337-2024": "segundo-protocolo-budapeste",
    "decreto-3468-2000": "assistencia-juridica-penal-mercosul",
    "decreto-7037-2009": "pndh-3",

    # MAGISTRATURA
    "lc-35-1979": "loman",

    # MINERÁRIO
    "decreto-lei-227-1967": "codigo-de-mineracao",
    "decreto-9406-2018": "regulamenta-codigo-mineracao",
    "lei-7805-1989": "permissao-lavra-garimpeira",
    "lei-6567-1978": "exploracao-substancias-minerais",
    "lei-13540-2017": "cfem",
    "lei-4146-1962": "recursos-minerais",
    "decreto-85064-1980": "regulamenta-mineracao",

    # MINISTÉRIO PÚBLICO
    "lc-75-1993": "estatuto-mpu",
    "lei-8625-1993": "lonmp",
    "lei-9028-1995": "atribuicoes-mpf-perante-stf",

    # NOTARIAL-REGISTRAL
    "lei-14382-2022": "serp",
    "lei-6015-1973": "registros-publicos-lrp",
    "lei-8935-1994": "lei-dos-cartorios",
    "lei-9492-1997": "lei-do-protesto",

    # PENAL
    "decreto-11491-2023": "convencao-crime-cibernetico",
    "decreto-lei-2848-1940": "codigo-penal",
    "decreto-lei-3688-1941": "lei-contravencoes-penais",
    "decreto-lei-3914-1941": "introducao-ao-codigo-penal",
    "lei-10446-2002": "infracoes-interestaduais",
    "lei-10826-2003": "estatuto-do-desarmamento",
    "lei-11340-2006": "lei-maria-da-penha",
    "lei-11343-2006": "lei-de-drogas",
    "lei-12694-2012": "juizo-colegiado",
    "lei-12850-2013": "organizacoes-criminosas",
    "lei-13344-2016": "trafico-de-pessoas",
    "lei-13869-2019": "abuso-de-autoridade",
    "lei-13964-2019": "pacote-anticrime",
    "lei-14132-2021": "lei-do-stalking",
    "lei-14344-2022": "lei-henry-borel",
    "lei-14811-2024": "bullying-e-cyberbullying",
    "lei-1521-1951": "crimes-contra-economia-popular",
    "lei-2889-1956": "crime-de-genocidio",
    "lei-7492-1986": "crimes-sistema-financeiro-nacional",
    "lei-7716-1989": "lei-de-racismo",
    "lei-8072-1990": "crimes-hediondos",
    "lei-9263-1996": "planejamento-familiar",
    "lei-9296-1996": "interceptacao-telefonica",
    "lei-9455-1997": "lei-de-tortura",
    "lei-9605-1998": "crimes-ambientais",
    "lei-9613-1998": "lavagem-de-dinheiro",
    "lei-13260-2016": "antiterrorismo",
    "lei-12737-2012": "crimes-informaticos-carolina-dieckmann",
    "lei-10357-2001": "controle-produtos-quimicos",
    "lei-5553-1968": "documentos-de-identificacao",
    "lei-13257-2016": "marco-legal-primeira-infancia",
    "lei-14230-2021": "reforma-improbidade-administrativa",

    # PENAL-PROCESSUAL-MILITAR
    "decreto-lei-1001-1969": "codigo-penal-militar",
    "decreto-lei-1002-1969": "codigo-processo-penal-militar",
    "lc-97-1999": "normas-gerais-forcas-armadas",
    "lei-6880-1980": "estatuto-dos-militares",

    # POLÍCIA CIVIL
    "lei-14735-2023": "lei-organica-policias-civis",

    # POLÍCIA FEDERAL
    "lei-9266-1996": "reorganizacao-pf",
    "lei-4878-1965": "regime-policiais-civis-federais",
    "lei-15047-2024": "regime-disciplinar-pf-pcdf",

    # PREVIDENCIÁRIO
    "decreto-3048-1999": "regulamento-previdencia-social",
    "lc-108-2001": "previdencia-complementar-entes-publicos",
    "lc-109-2001": "regime-previdencia-complementar",
    "lc-142-2013": "aposentadoria-pessoa-com-deficiencia",
    "lei-8212-1991": "lei-organica-seguridade-social",
    "lei-8213-1991": "planos-beneficios-previdencia",
    "lei-8742-1993": "lei-assistencia-social-loas",

    # PROCESSO CIVIL
    "lei-10259-2001": "juizados-especiais-federais",
    "lei-11419-2006": "processo-eletronico",
    "lei-12153-2009": "juizados-especiais-fazenda-publica",
    "lei-13105-2015": "codigo-de-processo-civil",
    "lei-13140-2015": "mediacao-e-conciliacao",
    "lei-7701-1988": "especializacao-turmas-trts",
    "lei-8437-1992": "medidas-cautelares-poder-publico",
    "lei-9099-1995": "juizados-especiais",
    "lei-9307-1996": "lei-de-arbitragem",
    "lei-9469-1997": "intervencao-anomala",
    "lei-9494-1997": "tutela-antecipada-fazenda-publica",

    # PROCESSO PENAL
    "decreto-lei-3689-1941": "codigo-de-processo-penal-cpp",
    "lei-11671-2008": "presidios-federais",
    "lei-12037-2009": "identificacao-criminal",
    "lei-12830-2013": "investigacao-criminal-delegado",
    "lei-7210-1984": "lei-de-execucao-penal-lep",
    "lei-7960-1989": "prisao-temporaria",
    "lei-8038-1990": "recursos-extraordinario-e-especial",
    "lei-9807-1999": "protecao-vitimas-e-testemunhas",

    # REGULAÇÃO ENERGIA
    "lei-9427-1996": "aneel",
    "lei-9478-1997": "politica-energetica-nacional-anp",

    # SANITÁRIO
    "decreto-7508-2011": "regulamenta-lei-organica-saude",
    "lei-8080-1990": "lei-organica-da-saude",
    "lei-8142-1990": "participacao-comunidade-gestao-sus",
    "lei-9434-1997": "lei-de-transplante",
    "lei-9656-1998": "planos-de-saude",

    # SEGURANÇA PÚBLICA
    "decreto-11693-2023": "organizacao-sisbin",
    "decreto-8793-2016": "politica-nacional-inteligencia",
    "decreto-9847-2019": "regulamenta-desarmamento",
    "lei-13675-2018": "susp",
    "lei-14967-2024": "estatuto-seguranca-privada",
    "lei-9883-1999": "abin-e-sisbin",
    "lei-13444-2017": "identificacao-civil-nacional",
    "lei-14534-2023": "cpf-como-identificacao",
    "decreto-10153-2019": "salvaguardas-informacoes-classificadas",

    # TELECOMUNICAÇÕES
    "lei-9472-1997": "lei-geral-telecomunicacoes",

    # TRABALHISTA
    "decreto-lei-5452-1943": "clt",
    "lc-150-2015": "trabalho-domestico",
    "lei-11788-2008": "lei-do-estagio",
    "lei-12506-2011": "aviso-previo-proporcional",
    "lei-13467-2017": "reforma-trabalhista",
    "lei-6019-1974": "trabalho-temporario-e-terceirizacao",
    "lei-605-1949": "repouso-semanal-remunerado",
    "lei-7418-1985": "vale-transporte",
    "lei-7783-1989": "lei-de-greve",
    "lei-8036-1990": "fgts",

    # TRÂNSITO
    "lei-9503-1997": "codigo-de-transito-brasileiro-ctb",

    # TRIBUTÁRIO
    "lc-116-2003": "iss-issqn",
    "lc-123-2006": "simples-nacional",
    "lc-192-2022": "icms-monofasico-combustiveis",
    "lc-214-2025": "reforma-tributaria",
    "lc-227-2026": "comite-gestor-ibs-cgibs",
    "lc-24-1975": "isencoes-icms-confaz",
    "lc-87-1996": "lei-kandir",
    "lei-5172-1966": "codigo-tributario-nacional",
    "lei-6830-1980": "lei-de-execucao-fiscal-lef",
    "lei-8137-1990": "crimes-contra-ordem-tributaria",
    "lei-8397-1992": "medida-cautelar-fiscal",
    "decreto-70235-1972": "processo-administrativo-fiscal",
    "lei-9430-1996": "legislacao-tributaria-federal",
    "lei-9250-1995": "irpf",
    "lei-9249-1995": "irpj-e-csll",
    "lei-10833-2003": "cofins-nao-cumulativa",
    "lei-10637-2002": "pis-pasep-nao-cumulativo",
    "lei-10865-2004": "pis-cofins-importacao",
    "lei-11196-2005": "lei-do-bem",
    "decreto-lei-1598-1977": "legislacao-ir-lucro-real",
    "lei-9532-1997": "legislacao-tributaria-federal-isencoes",
    "decreto-9580-2018": "regulamento-do-ir-rir",
    "decreto-lei-37-1966": "imposto-de-importacao",
    "decreto-lei-1455-1976": "bagagem-regime-aduaneiro",
    "lei-10336-2001": "cide-combustiveis",
    "lei-11457-2007": "super-receita",
    "decreto-6759-2009": "regulamento-aduaneiro",
    "lei-10522-2002": "cadin-e-parcelamento",
    "lei-9393-1996": "itr",
    "lei-7713-1988": "legislacao-ir",
    "decreto-lei-1578-1977": "imposto-de-exportacao",
    "lei-10168-2000": "cide-tecnologia",
    "lei-9718-1998": "pis-cofins-cumulativo",
    "lei-8218-1991": "infracoes-penalidades-tributarias",

    # URBANÍSTICO
    "lei-10257-2001": "estatuto-da-cidade",
    "lei-12587-2012": "mobilidade-urbana",
    "lei-13465-2017": "regularizacao-fundiaria",
    "lei-6766-1979": "parcelamento-solo-urbano",
}

def slugify(text):
    """Already slugified in the dict, but just in case."""
    text = unicodedata.normalize('NFKD', text)
    text = text.encode('ascii', 'ignore').decode('ascii')
    text = re.sub(r'[^\w\s-]', '', text.lower())
    text = re.sub(r'[-\s]+', '-', text).strip('-')
    return text

renamed = 0
skipped = 0
not_found = 0

for tema in sorted(os.listdir(SELECAO)):
    tema_path = os.path.join(SELECAO, tema)
    if not os.path.isdir(tema_path):
        continue
    for lei_dir in sorted(os.listdir(tema_path)):
        old_path = os.path.join(tema_path, lei_dir)
        if not os.path.isdir(old_path):
            continue

        # Skip if already renamed (has underscore)
        if "_" in lei_dir:
            skipped += 1
            continue

        nome = NOMES.get(lei_dir)

        if not nome:
            # Try to get from raw.json nickname
            raw_path = os.path.join(old_path, "raw.json")
            if os.path.isfile(raw_path):
                try:
                    data = json.load(open(raw_path, encoding="utf-8"))
                    doc = data.get("document", {})
                    nick = doc.get("legisNickname", "") or ""
                    if nick.strip():
                        nome = slugify(nick.strip())
                except:
                    pass

        if not nome:
            # Try ementa (first 60 chars)
            raw_path = os.path.join(old_path, "raw.json")
            if os.path.isfile(raw_path):
                try:
                    data = json.load(open(raw_path, encoding="utf-8"))
                    doc = data.get("document", {})
                    desc = doc.get("description", "") or ""
                    if desc:
                        # Take first meaningful words
                        desc = re.sub(r'<[^>]+>', '', desc)  # strip HTML
                        desc = desc[:80].strip()
                        nome = slugify(desc)[:60]
                except:
                    pass

        if nome:
            new_name = f"{lei_dir}_{nome}"
            new_path = os.path.join(tema_path, new_name)
            os.rename(old_path, new_path)
            renamed += 1
            print(f"  {tema}/{lei_dir} -> {new_name}")
        else:
            not_found += 1
            print(f"  [NO NAME] {tema}/{lei_dir}")

print(f"\n{'='*60}")
print(f"Renamed: {renamed} | Skipped: {skipped} | No name: {not_found}")
