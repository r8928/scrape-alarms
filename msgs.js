class msg {
  message;
  color = null;

  static step() {
    this.color = this.color || consoleColors.BgBlue;
    this.message = this.message || this.getMsg(arguments);
    console.log();
    console.log();
    console.log(
      this.color,
      consoleColors.Bright,
      this.message,
      consoleColors.Reset,
    );
    console.log();
    console.log();
    this.done();
  }

  static substep() {
    this.color = this.color || consoleColors.BgMagenta;
    this.message = this.message || this.getMsg(arguments);
    console.log();
    console.log();
    console.log(
      this.color,
      consoleColors.Bright,
      this.message,
      consoleColors.Reset,
    );
    this.done();
  }

  static error() {
    this.color = consoleColors.BgRed;
    this.step(this.getMsg(arguments));
  }

  static die() {
    this.error(this.getMsg(arguments));
    process.exit(-1);
  }

  static info() {
    console.log(
      consoleColors.FgYellow,
      this.getMsg(arguments),
      consoleColors.Reset,
    );
    this.done();
  }

  static getMsg(arg) {
    let message = [];
    for (let index = 0; index < arg.length; index++) {
      const item = arg[index];
      message.push(typeof item === 'string' ? item : JSON.stringify(item));
    }
    message = message.join(', ');
    return message;
  }

  static done() {
    this.color = null;
    this.message = null;
  }
}

const consoleColors = {
  Reset: '\x1b[0m',
  Bright: '\x1b[1m',
  Dim: '\x1b[2m',
  Underscore: '\x1b[4m',
  Blink: '\x1b[5m',
  Reverse: '\x1b[7m',
  Hidden: '\x1b[8m',

  FgBlack: '\x1b[30m',
  FgRed: '\x1b[31m',
  FgGreen: '\x1b[32m',
  FgYellow: '\x1b[33m',
  FgBlue: '\x1b[34m',
  FgMagenta: '\x1b[35m',
  FgCyan: '\x1b[36m',
  FgWhite: '\x1b[37m',

  BgBlack: '\x1b[40m',
  BgRed: '\x1b[41m',
  BgGreen: '\x1b[42m',
  BgYellow: '\x1b[43m',
  BgBlue: '\x1b[44m',
  BgMagenta: '\x1b[45m',
  BgCyan: '\x1b[46m',
  BgWhite: '\x1b[47m',
};

exports.msg = msg;
