'use strict'
const EOL = '\n'

module.exports = {
  command,
  header,
  footer,
  argv,
  flag,
  arg,
  rest,
  summary,
  description
}

class Parser {
  constructor (argv) {
    this.argv = argv
    this.i = 0
    this.multi = null
  }

  rest () {
    const rest = this.argv.slice(this.i)
    this.i = this.argv.length
    return rest
  }

  next () {
    while (true) {
      const r = {
        flag: null,
        rest: null,
        arg: null
      }

      if (this.multi && this.multi.length) {
        const name = this.multi.pop()
        r.flag = { long: false, name, value: '' }
        return r
      }

      this.multi = null

      if (this.i >= this.argv.length) return null
      const a = this.argv[this.i++]

      if (a === '--') {
        r.rest = this.rest()
        return r
      }

      if (a.length > 2 && a[0] === '-' && a[1] === '-') {
        let j = a.indexOf('=')
        if (j === -1) j = a.length
        const name = a.slice(2, j)
        const value = a.slice(j + 1)

        r.flag = { long: true, name, value }
        return r
      }

      if (a.length > 1 && a[0] === '-') {
        this.multi = []
        for (let i = 1; i < a.length; i++) this.multi.push(a[i])
        this.multi.reverse()
        continue
      }

      r.arg = a
      return r
    }
  }
}

class Command {
  constructor (parent, name) {
    this.parent = parent
    this.name = name
    this.description = ''
    this.summary = ''
    this.header = ''
    this.footer = ''

    this.flags = {}
    this.args = {}
    this.positionals = []
    this.rest = null
    this.bailed = null

    this._runner = null
    this._running = null

    this._delim = '-'
    this._strictFlags = true
    this._strictArgs = true

    this._definedCommands = new Map()
    this._definedFlags = new Map()
    this._definedArgs = []
    this._definedRest = null
  }

  bail (bail) {
    try {
      this.bailed = { output: this._bail(bail), bail }
    } catch (err) {
      this.bailed = { error: err, bail }
      throw err
    }
    return this.bailed
  }

  overview ({ full = false } = {}) {
    let s = ''
    if (this.header) s += EOL + this.header + EOL + EOL
    for (const [name, command] of this._definedCommands) {
      if (full) s += (s === '' ? '' : EOL) + command.usage()
      else s += '  ' + this.name + ' ' + name + ' ' + this._delim + ' ' + command.summary + EOL
    }

    if (this.footer) s += EOL + (this.footer.overview || this.footer) + EOL

    return s
  }

  help (...args) {
    let s = ''

    if (this.header) s += this.header + EOL + EOL

    s += this.usage(...args)

    if (this.footer) s += EOL + (this.footer.help || this.footer) + EOL

    return s
  }

  usage (subcommand, ...args) {
    if (subcommand) {
      const sub = this._definedCommands.get(subcommand)
      if (!sub) return this.bail(createBail('UNKNOWN_ARG', null, { value: subcommand }))
      return sub.usage(...args)
    }
    let s = ''

    s += this._signature(this._oneliner(false))

    if (this.summary) s += EOL + this.summary + EOL

    if (this.description) s += EOL + this.description + EOL

    s += this._aligned()

    return s
  }

  parse (input = argv()) {
    const p = new Parser(input)

    let c = this._reset()
    let bail = null

    const visited = [c]

    while (bail === null) {
      if (c._definedRest !== null && c.positionals.length === c._definedArgs.length) {
        bail = c._onrest(p.rest())
        break
      }

      const n = p.next()
      if (n === null) break

      if (n.flag) {
        bail = c._onflag(n.flag, p)
        continue
      }

      if (n.rest) {
        bail = c._onrest(n.rest)
        continue
      }

      if (c._definedCommands.size > 0) {
        const cmd = c._getCommand(n.arg)

        if (cmd !== null) {
          c = cmd._reset()
          visited.push(c)
          continue
        }
      }

      bail = c._onarg(n.arg)
    }

    if (!bail) {
      if (c._runner !== null) c._running = runAsync(c)
      return c
    }

    c.bail(bail)
    return null
  }

  _oneliner (short, relative) {
    const stack = [this]
    if (!relative) while (stack[stack.length - 1].parent) stack.push(stack[stack.length - 1].parent)

    const run = stack.reverse().map(c => c.name || 'app')

    if (!short) {
      if (this._definedFlags.size > 0) run.push('[flags]')
      for (const arg of this._definedArgs) run.push(arg.help)
      if (this._definedCommands.size > 0) run.push('[command]')
      if (this._definedRest !== null) run.push(this._definedRest.help)
    }

    return run.join(' ')
  }

  _aligned (padding = 0, color = false) {
    const l = []
    const visited = new Set()

    if (this._definedArgs.length > 0 || this._definedRest !== null) {
      l.push(['', ''])
      l.push([this._arguments, ''])
      for (const arg of this._definedArgs) {
        l.push(['  ' + arg.help, arg.usage()])
      }
      l.push([this._arguments, ''])
    }

    if (this._definedRest) {
      l.push(['  ' + this._definedRest.help, this._definedRest.description])
    }

    if (this._definedFlags.size) {
      l.push(['', ''])
      l.push([this._flags, ''])
      for (const flag of this._definedFlags.values()) {
        if (visited.has(flag)) continue
        visited.add(flag)

        l.push(['  ' + flag.help, flag.description])
      }
      l.push([this._flags, ''])
    }

    if (this._definedCommands.size) {
      l.push(['', ''])
      l.push([this._commands, ''])
      for (const c of this._definedCommands.values()) {
        l.push(['  ' + c._oneliner(true, true), c.description])
      }
      l.push([this._commands, ''])
    }

    if (padding === 0) {
      for (const [left, right] of l) {
        if (!right) continue
        if (left.length > padding) padding = left.length
      }
    }

    if (color === false) {
      return this._aligned(padding, true)
    }

    let s = ''
    let s2 = ''
    let mapper = null
    for (const [left, right] of l) {
      if (typeof left === 'function') {
        if (mapper === left) {
          s += mapper(s2)
          s2 = ''
          mapper = null
        } else {
          mapper = left
        }
        continue
      }
      if (mapper === null) s += (left.padEnd(padding, ' ') + '   ' + right).trimEnd() + EOL
      else s2 += (left.padEnd(padding, ' ') + '   ' + right).trimEnd() + EOL
    }

    s = s.trimEnd()

    return s ? s + EOL : ''
  }

  _addCommand (c) {
    this._definedCommands.set(c.name, c)
  }

  _addOpts (o) {
    this._strictFlags = !(o.sloppy?.flags)
    this._strictArgs = !(o.sloppy?.args)
    if (typeof o.signature === 'function') this._signature = o.signature
    if (typeof o.bail === 'function') this._bail = o.bail
    if (typeof o.commands === 'function') this._commands = o.commands
    if (typeof o.arguments === 'function') this._arguments = o.arguments
    if (typeof o.flags === 'function') this._flags = o.flags
    if (o.delim) this._delim = o.delim
  }

  _addFlag (f) {
    for (const alias of f.aliases) {
      this._definedFlags.set(alias, f)
    }
  }

  _addArg (a) {
    this._definedArgs.push(a)
  }

  _addRest (a) {
    this._definedRest = a
  }

  _addData (d) {
    switch (d.type) {
      case 'name': {
        this.name = d.value
        break
      }
      case 'summary': {
        this.summary = d.value
        break
      }
      case 'description': {
        this.description = d.value
        break
      }
      case 'header': {
        this.header = unindent(d.value)
        break
      }
      case 'footer': {
        this.footer = unindent(d.value)
        break
      }
    }
  }

  _add_Runner (_runner) {
    this._runner = _runner
  }

  _reset () {
    this.flags = {}
    this.args = {}
    this.positionals = []
    this.rest = null
    this._running = null

    return this
  }

  _getFlag (name) {
    let f = this._definedFlags.get(name)
    if (f === undefined && this._strictFlags === false) f = defaultFlag(name)
    return f || null
  }

  _getCommand (name) {
    return this._definedCommands.get(name) || null
  }

  _onflag (flag, parser) {
    const def = this._getFlag(flag.name)
    if (def === null) return createBail('UNKNOWN_FLAG', flag, null)

    if (def.boolean === true) {
      if (flag.value) return createBail('INVALID_FLAG', flag, null)
      this.flags[def.name] = true
      return null
    }

    if (def.boolean === false) {
      if (flag.value) {
        this.flags[def.name] = flag.value
        return null
      }

      const next = parser.next()
      if (next === null || !next.arg) return createBail('INVALID_FLAG', flag, null)
      this.flags[def.name] = next.arg
    }

    return null
  }

  _onarg (arg) {
    const info = { index: this.positionals.length, value: arg }
    if (this._definedArgs.length <= this.positionals.length) {
      if (this._strictArgs === false) {
        this.positionals.push(arg)
        return null
      }

      return createBail('UNKNOWN_ARG', null, info)
    }

    const def = this._definedArgs[this.positionals.length]
    this.positionals.push(arg)
    this.args[def.name] = arg

    return null
  }

  _onrest (rest) {
    if (this._definedRest === null) {
      return createBail('UNKNOWN_ARG', null, { index: this.positionals.length, value: '--' })
    }

    this.rest = rest
    return null
  }

  _signature (s) { return s + EOL }

  _arguments (s) { return 'Arguments:' + EOL + s }

  _flags (s) { return 'Flags:' + EOL + s }

  _commands (s) { return 'Commands:' + EOL + s }

  _bail (bail) {
    if (bail.flag) throw new Error(bail.reason + ': ' + bail.flag.name)
    if (bail.arg) throw new Error(bail.reason + ': ' + bail.arg.value)
    throw new Error(bail.reason)
  }
}

class Flag {
  constructor (help, description = '') {
    const { longName, shortName, aliases, boolean } = parseFlag(help)
    this.name = snakeToCamel(longName || shortName)
    this.aliases = aliases
    this.boolean = boolean
    this.help = help
    this.description = description
  }
}

class Arg {
  constructor (help, description = '') {
    this.optional = help.startsWith('[')
    this.name = snakeToCamel(help)
    this.help = help
    this.description = description
  }

  usage () {
    if (!this.optional) return this.description
    const first = this.description.slice(0, 1)
    return (first.toLowerCase() === first ? 'optional. ' : 'Optional. ') + this.description
  }
}

class Rest {
  constructor (help, description = '') {
    this.help = help
    this.description = description
  }
}

class Data {
  constructor (type, value) {
    this.type = type
    this.value = value
  }
}

function argv () {
  return typeof process === 'undefined' ? global.Bare.argv.slice(2) : process.argv.slice(2)
}

function command (name, ...args) {
  const c = new Command(null, name)

  for (const a of args) {
    if (a instanceof Command) {
      c._addCommand(a)
    } else if (a instanceof Flag) {
      c._addFlag(a)
    } else if (a instanceof Arg) {
      c._addArg(a)
    } else if (a instanceof Rest) {
      c._addRest(a)
    } else if (a instanceof Data) {
      c._addData(a)
    } else if (typeof a === 'function') {
      c._add_Runner(a)
    } else if (typeof a === 'object' && a?.constructor === Object) {
      c._addOpts(a)
    } else {
      throw new Error('Unknown arg: ' + a)
    }
  }

  return c
}

function summary (desc) {
  return new Data('summary', desc)
}

function description (desc) {
  return new Data('description', desc)
}

function header (desc) {
  return new Data('header', desc)
}

function footer (desc) {
  return new Data('footer', desc)
}

function flag (help, description) {
  return new Flag(help, description)
}

function rest (help, description) {
  return new Rest(help, description)
}

function arg (help, description) {
  return new Arg(help, description)
}

function unindent (info) {
  const lines = info.split('\n').filter(trimLine)
  if (!lines.length) return ''
  const indent = lines[0].match(/^(\s*)/)[1]

  let s = ''
  for (const line of lines) s += line.slice(indent.length).trimEnd() + '\n'
  return s.trimEnd()
}

function trimLine (line) {
  return line.trim()
}

function snakeToCamel (name) {
  const parts = name.match(/([a-zA-Z0-9-]+)/)[1].split(/-+/)
  for (let i = 1; i < parts.length; i++) parts[i] = parts[i].slice(0, 1).toUpperCase() + parts[i].slice(1)
  return parts.join('')
}

function parseFlag (help) {
  const parts = help.split(/[| ]/)
  const result = { longName: null, shortName: null, aliases: [], boolean: true }

  for (const p of parts) {
    if (p.startsWith('--')) {
      const name = trimFlag(p)
      if (result.longName === null) result.longName = name
      result.aliases.push(name)
      continue
    }

    if (p.startsWith('-')) {
      const name = trimFlag(p)
      if (result.shortName === null) result.shortName = name
      result.aliases.push(name)
      continue
    }

    if (p.startsWith('[') || p.startsWith('<')) {
      result.boolean = false
    }
  }

  return result
}

function trimFlag (s) {
  return s.replace(/(^[^0-9\w]+)|([^0-9\w]+$)/g, '')
}

function createBail (reason, flag, arg) {
  return {
    reason,
    flag,
    arg
  }
}

function defaultFlag (name) {
  return {
    name,
    aliases: [name],
    boolean: false,
    help: '',
    description: ''
  }
}

async function runAsync (c) {
  await c._runner({ args: c.args, flags: c.flags, positionals: c.positionals, rest: c.rest, command: c })
}
