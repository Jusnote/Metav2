// scripts/lei-graphql-extractor.js
// Run in browser console while on JusBrasil legislation page.
// Extracts all law items + document metadata via GraphQL API.

(async function() {
    const urlMatch = location.pathname.match(/\/legislacao\/(\d+)\//);
    const docId = urlMatch ? parseInt(urlMatch[1]) : parseInt(prompt('docId not found in URL. Enter manually:'));

    if (!docId || isNaN(docId)) {
        console.error('docId invalido');
        return;
    }

    console.log('Extraindo lei docId=' + docId + '...');

    // --- Step 1: Fetch document metadata ---
    console.log('1. Buscando metadados do documento...');
    var metaR = await fetch('/web-docview/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: '{ root { document: documentByNumericID(artifact: "LEGISLACAO", docId: ' + docId + ') { title description url type date docId status keywords metadata } } }'
        })
    });
    var metaData = await metaR.json();
    var doc = metaData && metaData.data && metaData.data.root && metaData.data.root.document;

    if (!doc) {
        console.error('Documento nao encontrado para docId=' + docId);
        return;
    }

    console.log('   Lei: ' + doc.title);
    console.log('   Tipo: ' + doc.type + ' | Status: ' + doc.status);
    console.log('   Ementa: ' + doc.description);

    // --- Step 2: Fetch all law items in batches ---
    console.log('2. Buscando dispositivos...');
    var batchSize = 500;
    var allItems = [];
    var start = 0;

    while (true) {
        var r = await fetch('/web-docview/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                operationName: 'LawItems',
                query: 'query LawItems($docId: NumericID!, $lawItemsStartFrom: Int!, $lawItemsLimit: Int) { root { document: documentByNumericID(artifact: "LEGISLACAO", docId: $docId) { lawItems(start: $lawItemsStartFrom, end: $lawItemsLimit) { codeInt64 type description revoked } } } }',
                variables: { docId: docId, lawItemsStartFrom: start, lawItemsLimit: start + batchSize }
            })
        });

        if (!r.ok) {
            console.error('HTTP ' + r.status + ' — voce esta logado no JusBrasil?');
            return;
        }

        var data = await r.json();
        var items = data && data.data && data.data.root && data.data.root.document && data.data.root.document.lawItems;

        if (!items) {
            console.error('Resposta inesperada da API:', data);
            return;
        }

        allItems = allItems.concat(items.map(function(item, i) {
            return {
                codeInt64: item.codeInt64,
                type: item.type,
                description: item.description,
                revoked: item.revoked,
                index: start + i
            };
        }));

        console.log('   Carregados ' + allItems.length + ' itens...');

        if (items.length < batchSize) break;
        start += batchSize;
    }

    // --- Step 3: Build structural with subtitles ---
    console.log('3. Construindo hierarquia...');
    var structuralTypes = ['PARTE', 'LIVRO', 'TITULO', 'CAPITULO', 'SECAO', 'SUBSECAO'];
    var structural = allItems
        .filter(function(i) { return structuralTypes.indexOf(i.type) >= 0; })
        .map(function(item) {
            var subtitle = null;
            for (var j = item.index + 1; j < Math.min(item.index + 5, allItems.length); j++) {
                var candidate = allItems[j];
                if (candidate.type !== 'NAO_IDENTIFICADO') break;
                if (!candidate.description.startsWith('(')) {
                    subtitle = candidate.description;
                    break;
                }
            }
            return {
                codeInt64: item.codeInt64,
                type: item.type,
                description: item.description,
                revoked: item.revoked,
                index: item.index,
                subtitle: subtitle
            };
        });

    var totalArticles = allItems.filter(function(i) { return i.type === 'ARTIGO'; }).length;
    var totalRevoked = allItems.filter(function(i) { return i.revoked === true; }).length;

    // --- Step 4: Assemble output ---
    window._lawData = {
        document: {
            title: doc.title,
            description: doc.description,
            url: doc.url,
            type: doc.type,
            date: doc.date,
            docId: doc.docId,
            status: doc.status,
            keywords: doc.keywords
        },
        allItems: allItems,
        structural: structural,
        stats: {
            totalItems: allItems.length,
            totalStructural: structural.length,
            totalArticles: totalArticles,
            totalRevoked: totalRevoked
        }
    };

    console.log('');
    console.log('PRONTO!');
    console.log('  ' + allItems.length + ' itens totais');
    console.log('  ' + structural.length + ' estruturais');
    console.log('  ' + totalArticles + ' artigos');
    console.log('  ' + totalRevoked + ' revogados');
    console.log('');
    console.log('Copiar TUDO:       copy(JSON.stringify(window._lawData.allItems, null, 2))');
    console.log('Copiar ESTRUTURAL: copy(JSON.stringify(window._lawData.structural, null, 2))');
    console.log('Copiar DOCUMENTO:  copy(JSON.stringify(window._lawData.document, null, 2))');
})();
