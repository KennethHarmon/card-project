// --------------------------------------------------------------------------------------------------------------------
// A named Logger.
//
// @module lib/logger
// --------------------------------------------------------------------------------------------------------------------

var util = require('util');

var logging = require('../logging');
var Context = require('./context').Context;

// --------------------------------------------------------------------------------------------------------------------

/**
 * A logger, used to log messages under a given name.
 *
 * Logger names are hierarchical, with levels separated by periods (`.`); the base Logger configuration is inherited
 * from the Logger's ancestors.
 *
 * @param {string} name - the name of the logger
 * @param {object} config - the configuration of the logger
 * @constructor
 */
function Logger(name, config)
{
    // Read-only 'name' property
    Object.defineProperty(this, 'name', {value: name, configurable: false, enumerable: true, writable: false});

    this.propagate = true;

    for(var key in config)
    {
        if(config.hasOwnProperty(key))
        {
            this[key] = config[key];
        } // end if
    } // end for
} // end Logger

Logger.loggerNamesSorted = [];

/**
 * Log a message.
 *
 * @param {string} level - the level (severity) to log the message at; should be one of the values in `logging.levels`
 * @param {string} message - the message string, contaianing zero or more `printf`-style placeholders (`%s`, `%d`,
 *          `%j`, or `%%`; see `util.format`)
 * @param {...*} args - arguments to render in place of placeholders in `message`; if more arguments than placeholders
 *          are present, they are converted to strings and concatenated to the message (see `util.format`)
 */
Logger.prototype.log = function log(level, message)
{
    if(logging.getLevelIdx(level) >= logging.getLevelIdx(this.level))
    {
        var context = new Context(this.name, level, message, Array.prototype.slice.call(arguments, 2));

        this.handlers.forEach(function eachHandler(handler)
        {
            if(handler)
            {
                try
                {
                    handler.log(context);
                }
                catch(exc)
                {
                    console.error("ERROR: Exception while logging to %j handler %s: %s",
                            handler.constructor.name,
                            util.inspect(handler),
                            exc.stack || util.inspect(exc)
                            );
                } // end try
            } // end if
        }); // end eachHandler
    } // end if
}; // end log

Logger.prototype.child = function(name)
{
    return logging.getLogger(this.name + '.' + name);
}; // end Logger#child

Logger.prototype.dump = logging.dump;

function logMethodTemplate(/*message, ...*/)
{
    this.log.apply(this, ['LEVEL'].concat(Array.prototype.slice.call(arguments)));
} // end logMethodTemplate

// Create Logger methods for each defined log level.
function initLogLevel(level)
{
    //jshint evil: true
    // (disable warning about 'eval'; needed to be able to set the log method's name to `level`)

    var logMethod = logMethodTemplate.toString()
        .replace('logMethodTemplate', level.toLowerCase())
        .replace('LEVEL', level);

    Logger.prototype[level.toLowerCase()] = eval('(function() { return ' + logMethod + '; })()');
} // end initLogLevel

logging.levels.forEach(initLogLevel);

function walkHierarchy(targetLoggerName, iterator, callback)
{
    var partialMatchEncountered = false;

    Logger.loggerNamesSorted.every(
            function eachLoggerName(loggerName)
            {
                if((targetLoggerName == loggerName || startsWith(targetLoggerName, loggerName + '.')) &&
                        logging.namedLoggers[loggerName])
                {
                    // If the current logger is an ancestor of the given name, call the iterator function.
                    iterator(logging.namedLoggers[loggerName], loggerName);
                    partialMatchEncountered = true;
                }
                else if(partialMatchEncountered)
                {
                    // We've already encountered at least one partial match, but the current name doesn't match; since
                    // the list is sorted, we can stop iterating now.
                    return false;
                } // end if

                return true;  // Keep looping over loggers.
            }); // end every

    if(callback)
    {
        callback();
    } // end if
} // end walkHierarchy

// Define Logger properties which inherit their values from ancestor Loggers.
function loggerProp(name)
{
    var privateVarName = '__' + name;

    function getter()
    {
        var value = logging.root[privateVarName];
        walkHierarchy(this.name,
                function eachLogger(logger)
                {
                    // If the current logger is an ancestor of this and it has a value with this name, override
                    // value with the ancestor's private variable.
                    value = logger[privateVarName] || value;
                });

        return value;
    } // end getter
    getter.name = '_get_' + name;

    function setter(value)
    {
        this[privateVarName] = value;
    } // end setter
    setter.name = '_set_' + name;

    Object.defineProperty(Logger.prototype, name, {'get': getter, 'set': setter});
} // end loggerProp

loggerProp('level');

Object.defineProperty(Logger.prototype, 'handlers', {
    'get': function getHandlers()
    {
        var handlers = logging.root.__handlers;
        walkHierarchy(this.name,
                function eachLogger(logger)
                {
                    if(!logger.propagate)
                    {
                        // This logger is set to not propagate any messages to its ancestors; clear the handlers list.
                        handlers = [];
                    } // end if

                    handlers = handlers.concat(logger.__handlers || []);
                });

        return handlers;
    }, // end getHandlers
    'set': function setHandlers(value)
    {
        this.__handlers = value;
    } // end setHandlers
}); // end 'handlers' property

// --------------------------------------------------------------------------------------------------------------------

function startsWith(value, prefix)
{
    return value == prefix || value.substr(0, prefix.length) == prefix;
} // end startsWith

// --------------------------------------------------------------------------------------------------------------------

module.exports = {
    Logger: Logger
};
