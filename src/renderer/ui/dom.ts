/** Crea un elemento a partir de un fragmento HTML con un único nodo raíz. */
export function el<T extends HTMLElement = HTMLElement>(html: string): T {
  const template = document.createElement('template')
  template.innerHTML = html.trim()
  return template.content.firstElementChild as T
}
