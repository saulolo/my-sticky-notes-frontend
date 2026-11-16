import { describe, expect, it } from 'vitest'
import { EXTERNAL_LINKS, externalLinkUrl, isExternalLinkKey } from '../../src/main/external-links'

describe('enlaces externos', () => {
  it('lista fija: correo, perfil y repo', () => {
    expect(EXTERNAL_LINKS).toEqual({
      email: 'mailto:saulolo@gmail.com',
      github: 'https://github.com/saulolo',
      repo: 'https://github.com/saulolo/my-sticky-notes-frontend'
    })
  })

  it.each(['email', 'github', 'repo'] as const)('la clave %s abre su URL', (key) => {
    expect(isExternalLinkKey(key)).toBe(true)
    expect(externalLinkUrl(key)).toBe(EXTERNAL_LINKS[key])
  })

  it.each([
    'https://example.com',
    'file:///C:/Windows/System32/calc.exe',
    'toString',
    '__proto__',
    'constructor',
    '',
    'EMAIL',
    42,
    null,
    undefined,
    { key: 'email' }
  ])('ignora %j', (value) => {
    expect(isExternalLinkKey(value)).toBe(false)
    expect(externalLinkUrl(value)).toBeNull()
  })
})
