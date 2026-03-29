import { getTable, insertRow, updateRows, upsertRow } from './store'

type Row = Record<string, unknown>

interface QueryResult {
  data: unknown
  error: null | { message: string }
}

// Parse join syntax from select string: "*, profiles!claims_member_id_fkey(full_name, member_id, plan_name)"
function parseSelect(selectStr: string): {
  columns: string | null // null means '*'
  joins: { table: string; fkColumn: string; columns: string[] }[]
} {
  const joins: { table: string; fkColumn: string; columns: string[] }[] = []

  // Extract join patterns
  const joinRegex = /(\w+)!(\w+)\(([^)]+)\)/g
  let match
  while ((match = joinRegex.exec(selectStr)) !== null) {
    const table = match[1]
    const fkName = match[2] // e.g. claims_member_id_fkey
    const columns = match[3].split(',').map((c) => c.trim())

    // Derive the FK column from the constraint name: claims_member_id_fkey -> member_id
    const fkMatch = fkName.match(/(\w+?)_fkey$/)
    let fkColumn = 'member_id' // default
    if (fkMatch) {
      // Strip table prefix: claims_member_id -> member_id
      const raw = fkMatch[1]
      const parts = raw.split('_')
      // Remove first part (table name) to get the column
      if (parts.length > 1) {
        parts.shift()
        fkColumn = parts.join('_')
      }
    }

    joins.push({ table, fkColumn, columns })
  }

  // Clean the select string of join patterns
  const cleaned = selectStr.replace(joinRegex, '').replace(/,\s*,/g, ',').replace(/^[\s,]+|[\s,]+$/g, '').trim()
  const columns = cleaned === '*' || cleaned === '' ? null : cleaned

  return { columns, joins }
}

function resolveJoins(
  rows: Row[],
  joins: { table: string; fkColumn: string; columns: string[] }[]
): Row[] {
  if (joins.length === 0) return rows

  return rows.map((row) => {
    const resolved = { ...row }
    for (const join of joins) {
      const joinTable = getTable(join.table)
      const fkValue = row[join.fkColumn]
      const related = joinTable.find((r) => r.id === fkValue)
      if (related) {
        const picked: Row = {}
        for (const col of join.columns) {
          picked[col] = related[col]
        }
        resolved[join.table] = picked
      } else {
        resolved[join.table] = null
      }
    }
    return resolved
  })
}

function pickColumns(rows: Row[], columns: string | null): Row[] {
  if (!columns) return rows
  const cols = columns.split(',').map((c) => c.trim())
  return rows.map((row) => {
    const picked: Row = {}
    for (const col of cols) {
      if (col in row) picked[col] = row[col]
    }
    return picked
  })
}

type Operation = 'select' | 'insert' | 'update' | 'upsert'

export class MockQueryBuilder implements PromiseLike<QueryResult> {
  private tableName: string
  private operation: Operation = 'select'
  private selectStr = '*'
  private filters: { column: string; value: unknown }[] = []
  private orderCol: string | null = null
  private orderAsc = true
  private limitN: number | null = null
  private isSingle = false
  private isMaybeSingle = false
  private insertData: Row | Row[] | null = null
  private updateData: Row | null = null
  private chainedSelect = false

  constructor(tableName: string) {
    this.tableName = tableName
  }

  select(columns = '*'): this {
    if (this.operation === 'insert') {
      this.chainedSelect = true
    } else {
      this.operation = 'select'
    }
    this.selectStr = columns
    return this
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ column, value })
    return this
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderCol = column
    this.orderAsc = options?.ascending ?? true
    return this
  }

  limit(n: number): this {
    this.limitN = n
    return this
  }

  single(): PromiseLike<QueryResult> {
    this.isSingle = true
    return this
  }

  maybeSingle(): PromiseLike<QueryResult> {
    this.isMaybeSingle = true
    return this
  }

  insert(data: Row | Row[]): this {
    this.operation = 'insert'
    this.insertData = data
    return this
  }

  update(data: Row): this {
    this.operation = 'update'
    this.updateData = data
    return this
  }

  upsert(data: Row | Row[]): this {
    this.operation = 'upsert'
    this.insertData = data
    return this
  }

  private execute(): QueryResult {
    switch (this.operation) {
      case 'select':
        return this.executeSelect()
      case 'insert':
        return this.executeInsert()
      case 'update':
        return this.executeUpdate()
      case 'upsert':
        return this.executeUpsert()
    }
  }

  private executeSelect(): QueryResult {
    let rows = [...getTable(this.tableName)]
    const { columns, joins } = parseSelect(this.selectStr)

    // Apply filters
    for (const f of this.filters) {
      rows = rows.filter((r) => r[f.column] === f.value)
    }

    // Resolve joins
    rows = resolveJoins(rows, joins)

    // Pick columns
    rows = pickColumns(rows, columns)

    // Sort
    if (this.orderCol) {
      const col = this.orderCol
      const asc = this.orderAsc
      rows.sort((a, b) => {
        const av = a[col] as string | number
        const bv = b[col] as string | number
        if (av < bv) return asc ? -1 : 1
        if (av > bv) return asc ? 1 : -1
        return 0
      })
    }

    // Limit
    if (this.limitN !== null) {
      rows = rows.slice(0, this.limitN)
    }

    // Single
    if (this.isSingle) {
      if (rows.length === 0) {
        return { data: null, error: { message: 'No rows found' } }
      }
      return { data: rows[0], error: null }
    }

    if (this.isMaybeSingle) {
      return { data: rows[0] || null, error: null }
    }

    return { data: rows, error: null }
  }

  private executeInsert(): QueryResult {
    const data = this.insertData
    if (!data) return { data: null, error: { message: 'No data to insert' } }

    const rows = Array.isArray(data) ? data : [data]
    for (const row of rows) {
      if (!row.id) {
        row.id = crypto.randomUUID()
      }
      insertRow(this.tableName, { ...row })
    }

    if (this.chainedSelect && this.isSingle) {
      return { data: rows[0], error: null }
    }
    if (this.chainedSelect) {
      return { data: Array.isArray(data) ? rows : rows[0], error: null }
    }

    return { data: null, error: null }
  }

  private executeUpdate(): QueryResult {
    if (!this.updateData) return { data: null, error: { message: 'No update data' } }
    if (this.filters.length === 0) return { data: null, error: { message: 'No filter for update' } }

    const f = this.filters[0]
    updateRows(this.tableName, this.updateData, f.column, f.value)
    return { data: null, error: null }
  }

  private executeUpsert(): QueryResult {
    const data = this.insertData
    if (!data) return { data: null, error: { message: 'No data to upsert' } }

    const rows = Array.isArray(data) ? data : [data]
    for (const row of rows) {
      upsertRow(this.tableName, { ...row })
    }
    return { data: null, error: null }
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    try {
      const result = this.execute()
      return Promise.resolve(result).then(onfulfilled, onrejected)
    } catch (err) {
      return Promise.reject(err).then(onfulfilled, onrejected) as Promise<TResult1 | TResult2>
    }
  }
}
