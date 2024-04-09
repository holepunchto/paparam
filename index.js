const EOL = '\n'

module.exports = {
  papa,
  command,
  header,
  footer,
  argv,
  flag,
  arg,
  rest,
  name,
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
    this.header = description
    this.footer = ''
    this.runner = null
    this.running = null

    this.definedCommands = new Map()
    this.definedFlags = new Map()
    this.definedArgs = []
    this.definedRest = null

    this.strictFlags = true
    this.strictArgs = true

    this.flags = {}
    this.args = {}
    this.positionals = []
    this.rest = null
    this.running = null
  }

  _oneliner (short, relative) {
    const stack = [this]
    if (!relative) while (stack[stack.length - 1].parent) stack.push(stack[stack.length - 1].parent)

    const run = stack.reverse().map(c => c.name || 'app')

    if (!short) {
      if (this.definedFlags.size > 0) run.push('[flags]')
      for (const arg of this.definedArgs) run.push(arg.help)
      if (this.definedCommands.size > 0) run.push('[command]')
      if (this.definedRest !== null) run.push(this.definedRest.help)
    }

    return run.join(' ')
  }

  _aligned (padding = 0, color = false) {
    const l = []
    const visited = new Set()

    if (this.definedArgs.length > 0 || this.definedRest !== null) {
      l.push(['', ''])
      l.push(['Arguments:', ''])
    }

    for (const arg of this.definedArgs) {
      l.push(['  ' + arg.help, arg.fullDescription()])
    }
    if (this.definedRest) {
      l.push(['  ' + this.definedRest.help, this.definedRest.description])
    }

    if (this.definedFlags.size) {
      l.push(['', ''])
      l.push(['Flags:', ''])
    }

    for (const flag of this.definedFlags.values()) {
      if (visited.has(flag)) continue
      visited.add(flag)

      l.push(['  ' + flag.help, flag.description])
    }

    if (this.definedCommands.size) {
      l.push(['', ''])
      l.push(['Commands:', ''])
    }

    for (const c of this.definedCommands.values()) {
      l.push(['  ' + c._oneliner(true, true), c.description])
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
    for (const [left, right] of l) {
      s += (left.padEnd(padding, ' ') + '   ' + right).trimRight() + EOL
    }
    s = s.trimRight()

    return s ? s + EOL : ''
  }

  usage () {
    let s = ''
    s += 'Usage: ' + this._oneliner(false) + EOL

    if (this.header || this.description) {
      s += EOL
      s += (this.header || this.description) + EOL
    }

    s += this._aligned()

    if (this.footer) {
      s += EOL
      s += this.footer + EOL
    }

    return s
  }

  help () {
    console.log(this.usage().trim())
  }

  addCommand (c) {
    this.definedCommands.set(c.name, c)
  }

  addFlag (f) {
    for (const alias of f.aliases) {
      this.definedFlags.set(alias, f)
    }
  }

  addArg (a) {
    this.definedArgs.push(a)
  }

  addRest (a) {
    this.definedRest = a
  }

  addData (d) {
    switch (d.type) {
      case 'name': {
        this.name = d.value
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

  addRunner (runner) {
    this.runner = runner
  }

  reset () {
    this.flags = {}
    this.args = {}
    this.positionals = []
    this.rest = null
    this.running = null

    return this
  }

  _getFlag (name) {
    let f = this.definedFlags.get(name)
    if (f === undefined && this.strictFlags === false) f = defaultFlag(name)
    return f || null
  }

  _getCommand (name) {
    return this.definedCommands.get(name) || null
  }

  sloppy ({ flags = false, args = false } = {}) {
    this.strictFlags = flags
    this.strictArgs = args
  }

  _onflag (parser, flag) {
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

  _onarg (parser, arg) {
    const info = { index: this.positionals.length, value: arg }

    if (this.definedArgs.length <= this.positionals.length) {
      if (this.strictArgs === false) {
        this.positionals.push(arg)
        return null
      }

      return createBail('UNKNOWN_ARG', null, info)
    }

    const def = this.definedArgs[this.positionals.length]
    this.positionals.push(arg)
    this.args[def.name] = arg

    return null
  }

  _onrest (parser, rest) {
    if (this.definedRest === null) {
      return createBail('UNKNOWN_ARG', null, { index: this.positionals.length, value: '--' })
    }

    this.rest = rest
    return null
  }

  _onbail (bail) {
    // TODO: should autogen help etc based on options or whatever is setup

    if (bail.flag) throw new Error(bail.reason + ': ' + bail.flag.name)
    if (bail.arg) throw new Error(bail.reason + ': ' + bail.arg.value)

    throw new Error(bail.reason)
  }

  parse (input = argv()) {
    const p = new Parser(input)

    let c = this.reset()
    let bail = null

    const visited = [c]

    while (bail === null) {
      if (c.definedRest !== null && c.positionals.length === c.definedArgs.length) {
        bail = c._onrest(p, p.rest())
        break
      }

      const n = p.next()
      if (n === null) break

      if (n.flag) {
        bail = c._onflag(p, n.flag)
        continue
      }

      if (n.rest) {
        bail = c._onrest(p, n.rest)
        continue
      }

      if (c.definedCommands.size > 0) {
        const cmd = c._getCommand(n.arg)

        if (cmd !== null) {
          c = cmd.reset()
          visited.push(c)
          continue
        }
      }

      bail = c._onarg(p, n.arg)
    }

    if (!bail) {
      if (c.runner !== null) c.running = runAsync(c)
      return c
    }

    c._onbail(bail)
    return null
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

  fullDescription () {
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

function papa (name, ...args) {
  const cmd = typeof name === 'string' ? command(name, ...args) : command(null, name, ...args)
  return cmd.parse()
}

function argv () {
  return typeof process === 'undefined' ? global.Bare.argv.slice(2) : process.argv.slice(2)
}

function command (name, ...args) {
  const c = new Command(null, name)

  for (const a of args) {
    if (a instanceof Command) {
      c.addCommand(a)
    } else if (a instanceof Flag) {
      c.addFlag(a)
    } else if (a instanceof Arg) {
      c.addArg(a)
    } else if (a instanceof Rest) {
      c.addRest(a)
    } else if (a instanceof Data) {
      c.addData(a)
    } else if (typeof a === 'function') {
      c.addRunner(a)
    } else {
      throw new Error('Unknown arg: ' + a)
    }
  }

  return c
}

function name (name) {
  return new Data('name', name)
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
  for (const line of lines) s += line.slice(indent.length).trimRight() + '\n'
  return s.trimRight()
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
  const parts = help.split(/\s+/)
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
  await c.runner({ args: c.args, flags: c.flags, positionals: c.positionals, rest: c.rest, command: c })
}
