import { Client, cacheExchange, fetchExchange } from 'urql'

const EDITAIS_API_URL = process.env.NEXT_PUBLIC_EDITAIS_API_URL
  ?? 'https://editais.projetopapiro.com.br/graphql'

export const editaisClient = new Client({
  url: EDITAIS_API_URL,
  exchanges: [cacheExchange, fetchExchange],
})
