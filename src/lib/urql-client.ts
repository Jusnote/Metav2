import { Client, cacheExchange, fetchExchange } from 'urql'

const API_URL = process.env.NEXT_PUBLIC_LEI_API_URL
  ?? 'http://localhost:3001/graphql'

export const leiClient = new Client({
  url: API_URL,
  exchanges: [cacheExchange, fetchExchange],
})
