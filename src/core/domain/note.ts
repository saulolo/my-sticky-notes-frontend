export interface Subtask {
  id: string
  /** No vacío, sin espacios en los extremos. */
  text: string
  done: boolean
}

export interface Task {
  id: string
  /** Hora local de creación, 0–23. Se muestra tal cual: "9", "13". */
  hour: number
  text: string
  done: boolean
  subtasks: Subtask[]
  /** ISO 8601. Desempata y queda para usos futuros. */
  createdAt: string
}

export interface Note {
  title: string
  /** Orden de inserción: las nuevas van al final. */
  tasks: Task[]
}

export const DEFAULT_TITLE = 'Today Task'

export function createEmptyNote(): Note {
  return { title: DEFAULT_TITLE, tasks: [] }
}
