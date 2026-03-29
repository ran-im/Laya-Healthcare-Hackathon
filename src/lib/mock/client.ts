import { MockQueryBuilder } from './query-builder'
import { createMockAuth, type MockAuthOptions } from './auth'
import { createMockStorage } from './storage'

export function createMockClient(options?: MockAuthOptions) {
  return {
    from(table: string) {
      return new MockQueryBuilder(table)
    },
    auth: createMockAuth(options),
    storage: createMockStorage(),
  }
}
