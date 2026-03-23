export const LEIS_QUERY = `
  query Leis {
    leis(limit: 200) {
      nodes { id titulo apelido tipo nivel }
      totalCount
    }
  }
`

export const LEI_QUERY = `
  query Lei($id: String!) {
    lei(id: $id) {
      id titulo apelido ementa tipo nivel data status
      hierarquia
      stats { totalDispositivos totalArtigos totalRevogados }
    }
  }
`

export const DISPOSITIVOS_QUERY = `
  query Dispositivos($leiId: String!, $offset: Int!, $limit: Int!, $incluirRevogados: Boolean) {
    dispositivos(leiId: $leiId, offset: $offset, limit: $limit, incluirRevogados: $incluirRevogados) {
      nodes {
        id tipo numero texto epigrafe pena
        anotacoes links revogado path posicao
      }
      totalCount
    }
  }
`

export const BUSCA_QUERY = `
  query Busca($termo: String!, $leiId: String, $limit: Int) {
    busca(termo: $termo, leiId: $leiId, limit: $limit) {
      total
      hits {
        dispositivo { id tipo numero texto posicao }
        lei { id titulo }
        highlight
        score
      }
    }
  }
`
