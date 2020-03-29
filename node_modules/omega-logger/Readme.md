# Omega logger #

A simple and powerful logger inspired by
[Python's `logging` module](http://docs.python.org/release/2.7.3/library/logging.html). While designed for use in
[omega](https://github.com/Morgul/omega), it is general enough that it can be used just about anywhere.



## Basic use ##

```javascript
var logger = require('omega-logger').loggerFor(module);

logger.warn("This is a warning. You have to the count of %s to surrender.", 3);
logger.info("Also, you might want to know this information. It's useful.");
logger.critical("OMG, we have an object: %s", logger.dump({foo: "bar"}));
```


### Dumping objects ###

If you need to dump an object, you can use the convienence function, `logger.dump(object)`. (also available as
`require('omega-logger').dump`) This is just a wrapper for Node's `util.inspect` that will automatically produce color
output when logged to the console, but not in other log handlers.

```javascript
logger.info("Here's your object:", logger.dump({some: 'object'}));
```



## Configuration ##

### Configuring Loggers ###

You can configure individual loggers:

```javascript
var logger = require('omega-logger').loggerFor(module);

// Only display messages from this logger if they're at the 'INFO' level or above.
logger.level = 'INFO';
```

To change the configuration for all loggers, simply modify the `root` logger:

```javascript
var logging = require('omega-logger');

logging.root.level = 'DEBUG';
```

Note that this does _not_ change the logging level of any of the handlers; instead, you would have to configure the
handler directly. (for instance, if you want to change what levels of messages are printed to the console, you would
need to set the level of the ConsoleHandler; see below)

See the [`Logger`](#logger) documentation below for more information about the properties and methods available.


### Configuring Handlers ###

Handlers are the objects that actually do something with log messages, like print them to the console or write them to
a file. They can be configured similarly to loggers:

```javascript
var logging = require('omega-logger');
var ConsoleHandler = logging.handlers.console;

var logger = logging.loggerFor(module);

logging.root.handlers = [
	new ConsoleHandler()
];
```

Each handler has its own `level` setting, similar to loggers:

```javascript
logging.root.handlers = [
	new ConsoleHandler({
		// Only display messages on this handler if they're at the 'WARN' level or above.
		level: 'WARN'
	})
];
```

**Note:** The `console` handler defaults to only displaying messages at the `INFO` level or above; other handlers
default to logging messages at any level. If you wish to change the level of messages printed to the console, you can
simply change the default `console` handler's level directly:

```javascript
logging.root.handlers[0].level = 'DEBUG';
```

Each logger can have its own collection of handlers, though typically only the `root` logger has any configured. The
`propagate` property on `Logger` instances controls whether or not messages get propagated to ancestor loggers'
handlers. (see the `Logger` documentation below)



## The `omega-logger` Module

### Properties ###

* `levels` - the list of logging levels, in order from lowest to highest severity (default:
`['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL']`)
* `root` - the root logger; generally speaking, you should **NOT** log to this


### Functions ###

#### `loggerFor(object)`
Get a logger for the object passed in. Typically, this should be the `module` object.

#### `getLogger(name)`
Retrieve (or create, if needed) the logger with the given name.

#### `log(level, message)`
A convenience logging method, for when you don't want to have to call `getLogger()` first. Instead of using this, you
should probably use `logging.loggerFor(module)` or `logging.getLogger('logger.name')`, and log using the returned
`Logger` instance.

#### `dump(object[, depth])`
Render a dump of the given object. You may specify a maximum depth to render. (defaults to 2) When logged to the
`console` handler, the dump will be colored using [ANSI escape codes][]; when logged to other handlers, it will be
rendered as plain text.

[ANSI escape codes]: http://en.wikipedia.org/wiki/ANSI_escape_code#CSI_codes



## `Logger` ##

Loggers may be configured by setting properties on each logger instance. Logger properties are inherited from parent
loggers if not specified on a given logger; if no logger in the hierarchy sets a given property, it is retrieved from
the `root` logger.


### Properties ###

* `name` - the name of the logger; **read-only**
* `level` - the minimum log level at which messages from this logger or its descendants will be logged (default: log
   all messages)
* `handlers` - the list of log handlers which should be notified when a messages is logged to this logger or one of its
   descendants
* `propagate` - if set to `false`, this will prevent this logger from passing log messages on to any of its ancestors'
   handlers (default: `true`)


### Methods ###

#### `logger.info(message, ...)`, `logger.warn(message, ...)`, `logger.error(message, ...)`, etc.
The log methods. These are automatically created for all built-in log levels, and are shorthand for:

```javascript
logger.log(level, message, ...);
```

...where `level` is the level corresponding to the log method's name.

#### `logger.log(level, message, ...)`
The main implementation method of logging. If any arguments are passed after the message, they are passed to
`util.format(message)` as additional arguments. Then, the given message and level are passed on to any configured
handlers on the given logger, and finally to the parent logger, if `propagate` is true.

#### `logger.dump(object[, depth])`
Render a dump of the given object. An alias of `require('omega-logger').dump`.



## Handlers ##

Handlers are responsible for displaying or recording log messages to a given place, such as the console or a file.


### Properties ###

Log handler properties may either be set when instantiating a handler (by passing them into the constructor in an
object), or after the handler's been created (by setting the property on the handler object directly). See the
individual handler objects below for a list of the available properties of each.

### Methods ###

#### `handler.onMessage(context)`
The main implementation method for log handlers; the message is already rolled into a `Context` instance, allowing for
easy string formatting using `logging.strFormat(formatString, context /*, positional args... */)`.


### Available Handlers ###

#### `logging.handlers.console`
The default console logger; provides [ANSI-colored](https://en.wikipedia.org/wiki/ANSI_escape_sequence) log
output to the console.

##### Properties:

* `format` - the format string used when writing messages to the console (default:
   `'\033[90m{datetime}\033[m \033[1;30m[\033[{levelColor}m{level}\033[1;30m]\033[0;1m {logger}:\033[m {message}'`)
* `level` - the minimum log level at which messages will be logged to this handler (default: `'DEBUG'`)
* `levelColors` - an object associating logging levels with
   [ANSI terminal colors](http://en.wikipedia.org/wiki/ANSI_escape_code#Colors). (default:
   `{TRACE: '1;30', DEBUG: '37', INFO: '32', WARN: '33', ERROR: '31', CRITICAL: '1;31'}`)


#### `logging.handlers.file`
A handler that can write to a file. You can set the following properties to change its behavior:

##### Properties:

* `format` - the format string used when writing messages to the file (default:
   `'{datetime} [{level}] {logger}: {message}'`)
* `level` - the minimum log level at which messages will be logged to this handler (default: `'DEBUG'`)
* `newline` - the newline character(s) to write after each line (default: `'\n'`)
* `fileName` - the name of the file to log to (default: `'./logging.log'`)
* `fileFlags` - the flags to use when opening the log file; use `'w'` to truncate the log each time it's opened, or
   `'a'` to append to the log if it exists (default: `'a'`)
* `fileEncoding` - the encoding to use when opening the file (default: `null`)
* `fileMode` - the octal [UNIX file mode](https://en.wikipedia.org/wiki/File_system_permissions#Numeric_notation) to
   use if creating a new log file (default: `0660`)


## TODO ##

See [the issue list on GitHub](https://github.com/Morgul/omega-logger/issues).
